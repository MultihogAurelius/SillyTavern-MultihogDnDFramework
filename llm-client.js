/**
 * llm-client.js — Multihog D&D Framework
 * All external LLM networking. Stateless — reads state via parameter, no DOM.
 * Handles Ollama, OpenAI-compatible, and SillyTavern Profile/generateRaw modes.
 *
 * Imports: state-manager.js
 * Imported by: index.js, memo-processor.js
 */

import { getSettings } from './state-manager.js';
import { logTransaction } from './debug-viewer.js';
import { parseJsonWithColorRepair } from './memo-processor.js';

/** Placeholder that survives SillyTavern substituteParams() in generateRaw. */
export const RT_USER_MACRO_SENTINEL = '__RT_USER_MACRO__';

function parseToolCallArguments(rawArguments) {
    if (typeof rawArguments !== 'string') {
        return { args: rawArguments ?? {}, argumentError: null };
    }
    const parsed = parseJsonWithColorRepair(rawArguments);
    return parsed.ok
        ? { args: parsed.value, argumentError: null }
        : { args: {}, argumentError: parsed.error };
}

/** Prevents {{user}} from being resolved to the active persona name before an LLM call. */
export function shieldUserMacro(text) {
    if (!text) return text;
    return String(text).replace(/\{\{user\}\}/gi, RT_USER_MACRO_SENTINEL);
}

/**
 * Restores {{user}} after an LLM call and rewrites any leaked persona/player names.
 * @param {string} text
 * @param {string[]} [names] Persona or player names to replace with {{user}}
 */
export function restoreUserMacro(text, names = []) {
    if (!text) return text;
    let out = String(text).split(RT_USER_MACRO_SENTINEL).join('{{user}}');
    const unique = [...new Set((names || []).map(n => String(n).trim()).filter(n => n.length >= 2))];
    unique.sort((a, b) => b.length - a.length);
    for (const name of unique) {
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(`\\b${esc}'s\\b`, 'gi'), "{{user}}'s");
        out = out.replace(new RegExp(`\\b${esc}\\b`, 'g'), '{{user}}');
    }
    return out;
}

// ── Connection Profile Helpers ─────────────────────────────────────────────────

export async function checkConnectionProfilesActive() {
    return $('#sys-settings-button').find('#connection_profiles').length > 0;
}

export async function getConnectionProfiles() {
    if (!(await checkConnectionProfilesActive())) return [];
    const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
    const result = await executeSlashCommandsWithOptions(`/profile-list`);
    try {
        return JSON.parse(result.pipe);
    } catch {
        return [];
    }
}

export async function getCurrentCompletionPreset() {
    try {
        const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
        if (typeof executeSlashCommandsWithOptions !== 'function') return null;
        const result = await executeSlashCommandsWithOptions('/preset');
        return result?.pipe?.trim() || null;
    } catch {
        return null;
    }
}

export async function setCompletionPreset(name) {
    if (!name) return;
    const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
    await executeSlashCommandsWithOptions(`/preset "${name}"`);
}

const LIVE_CHAT_COMPLETION_OVERRIDE_FIELDS = [
    'custom_url',
    'vertexai_region',
    'zai_endpoint',
    'siliconflow_endpoint',
    'minimax_endpoint',
    'reverse_proxy',
    'proxy_password',
];

// Chat Completion presets contain connection-routing fields as well as sampler
// settings. ConnectionManagerRequestService applies the whole preset after it
// has selected the profile, so these payload overrides are required to keep an
// OpenRouter profile's live routing controls authoritative.
const LIVE_OPENROUTER_ROUTING_FIELDS = {
    openrouter_providers: 'provider',
    openrouter_quantizations: 'quantizations',
    openrouter_allow_fallbacks: 'allow_fallbacks',
    openrouter_use_fallback: 'use_fallback',
    openrouter_middleout: 'middleout',
};

function completionPresetExists(context, name) {
    const wanted = String(name || '').trim();
    if (!wanted) return false;
    if (typeof context.getPresetManager !== 'function') return true;
    for (const type of [undefined, 'openai', 'textgenerationwebui']) {
        const manager = type ? context.getPresetManager(type) : context.getPresetManager();
        if (manager?.getCompletionPresetByName?.(wanted)) return true;
    }
    return false;
}

function applyLiveChatCompletionOverrides(context, profile, overridePayload = {}) {
    const live = context.chatCompletionSettings || {};
    for (const field of LIVE_CHAT_COMPLETION_OVERRIDE_FIELDS) {
        if (overridePayload[field] == null || overridePayload[field] === '') {
            const value = live[field];
            if (value != null && value !== '') overridePayload[field] = value;
        }
    }

    if (String(profile?.api || '').toLowerCase() === 'openrouter') {
        for (const [settingsField, payloadField] of Object.entries(LIVE_OPENROUTER_ROUTING_FIELDS)) {
            if (overridePayload[payloadField] !== undefined || live[settingsField] === undefined) continue;
            const value = live[settingsField];
            overridePayload[payloadField] = Array.isArray(value) ? [...value] : value;
        }
    }

    return overridePayload;
}

/** Prefer an explicit override, then the profile's preset, then the live ST preset. */
async function resolveProfilePresetName(context, requestedPreset, profile) {
    const candidates = [
        String(requestedPreset || '').trim(),
        String(profile?.preset || '').trim(),
        String(await getCurrentCompletionPreset() || '').trim(),
    ];
    for (const name of candidates) {
        if (name && completionPresetExists(context, name)) return name;
    }
    return '';
}

function positiveTokenCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

/**
 * Resolve the response cap for background requests.
 *
 * `maxTokens: 0` means "inherit SillyTavern's configured response length", not
 * "let the backend choose a default". Direct ChatCompletionService and custom
 * backend calls bypass generateRaw's normal inheritance, so they need the live
 * value copied into their payload explicitly. A selected completion preset is
 * left authoritative because its own token setting is applied downstream.
 */
export function resolveStateRequestMaxTokens(settings = {}, context = {}) {
    const explicit = positiveTokenCount(settings.maxTokens);
    if (explicit) return explicit;

    const presetName = String(settings.completionPresetId || '').trim();
    if (presetName) {
        try {
            for (const type of [undefined, 'textgenerationwebui', 'openai']) {
                const manager = type ? context.getPresetManager?.(type) : context.getPresetManager?.();
                const preset = manager?.getCompletionPresetByName?.(presetName);
                const fromPreset = positiveTokenCount(
                    preset?.openai_max_tokens
                    ?? preset?.genamt
                    ?? preset?.max_tokens
                    ?? preset?.max_length,
                );
                if (fromPreset) return fromPreset;
            }
        } catch { /* the downstream preset service can still apply it */ }
        return undefined;
    }

    try {
        const expanded = context.substituteParams?.('{{maxResponseTokens}}');
        const fromMacro = positiveTokenCount(expanded);
        if (fromMacro) return fromMacro;
    } catch { /* older SillyTavern builds may not expose substituteParams */ }

    if (context.mainApi === 'openai') {
        return positiveTokenCount(context.chatCompletionSettings?.openai_max_tokens);
    }
    return undefined;
}

/**
 * Profile requests without a CC preset omit custom_url and 404 on Custom OpenAI.
 * "Use Current Settings" must still attach a real preset or the live endpoint URL.
 */
async function sendViaConnectionProfile(context, settings, messages, { signal = null, extraOverride = {}, stream = false } = {}) {
    const service = context.ConnectionManagerRequestService;
    const profile = typeof service.getProfile === 'function'
        ? service.getProfile(settings.connectionProfileId)
        : null;
    const effectivePreset = await resolveProfilePresetName(context, settings.completionPresetId, profile);
    const maxTokens = resolveStateRequestMaxTokens(
        effectivePreset ? { ...settings, completionPresetId: effectivePreset } : settings,
        context,
    );
    const overridePayload = applyLiveChatCompletionOverrides(context, profile, { ...extraOverride });
    let profileOriginalPreset = null;
    try {
        if (effectivePreset && profile && profile.preset !== effectivePreset) {
            profileOriginalPreset = profile.preset;
            profile.preset = effectivePreset;
        }
        return await service.sendRequest(
            settings.connectionProfileId,
            messages,
            maxTokens,
            {
                stream: !!stream,
                extractData: true,
                includePreset: !!effectivePreset,
                includeInstruct: true,
                signal,
            },
            overridePayload,
        );
    } finally {
        if (profile && profileOriginalPreset !== null) {
            profile.preset = profileOriginalPreset;
        }
    }
}

/** Resolve the live Chat Completion model without importing openai.js (keeps unit tests light). */
function liveChatCompletionModel(live) {
    if (!live || typeof live !== 'object') return '';
    const source = String(live.chat_completion_source || '');
    const keys = {
        openai: 'openai_model',
        claude: 'claude_model',
        makersuite: 'google_model',
        vertexai: 'vertexai_model',
        openrouter: 'openrouter_model',
        custom: 'custom_model',
        nanogpt: 'nanogpt_model',
        cohere: 'cohere_model',
        groq: 'groq_model',
        mistralai: 'mistralai_model',
        deepseek: 'deepseek_model',
        xai: 'xai_model',
        aimlapi: 'aimlapi_model',
        siliconflow: 'siliconflow_model',
        minimax: 'minimax_model',
        electronhub: 'electronhub_model',
        chutes: 'chutes_model',
        fireworks: 'fireworks_model',
        moonshot: 'moonshot_model',
        pollinations: 'pollinations_model',
        cometapi: 'cometapi_model',
        perplexity: 'perplexity_model',
        ai21: 'ai21_model',
        azure_openai: 'azure_openai_model',
    };
    const key = keys[source];
    if (key && live[key]) return live[key];
    return live.openai_model || live.custom_model || live.nanogpt_model || live.openrouter_model || '';
}

/**
 * Drain a ConnectionManager / ChatCompletionService payload into a string.
 * Streaming generators keep the HTTP socket alive so provider idle cutoffs
 * (OpenRouter / nano-gpt ~60s of silence) cannot drop a finished reply.
 */
export async function collectCompletionText(raw) {
    if (raw == null) return '';
    if (typeof raw === 'function') {
        let text = '';
        let reasoning = '';
        for await (const chunk of raw()) {
            if (typeof chunk === 'string') {
                text = chunk;
                continue;
            }
            if (!chunk || typeof chunk !== 'object') continue;
            if (typeof chunk.text === 'string') text = chunk.text;
            else if (typeof chunk.content === 'string') text = chunk.content;
            if (typeof chunk.state?.reasoning === 'string') reasoning = chunk.state.reasoning;
            else if (typeof chunk.reasoning === 'string') reasoning = chunk.reasoning;
        }
        return text || reasoning || '';
    }
    if (typeof raw === 'string') return raw;
    const r = /** @type {any} */ (raw);
    let text = r?.content
        ?? r?.message?.content
        ?? r?.choices?.[0]?.message?.content
        ?? r?.choices?.[0]?.text
        ?? null;
    if (text === null || text === undefined || text === '') {
        text = r?.reasoning
            ?? r?.message?.reasoning
            ?? r?.choices?.[0]?.message?.reasoning
            ?? r?.choices?.[0]?.message?.reasoning_content
            ?? '';
    }
    if (text && typeof text === 'object') text = JSON.stringify(text);
    return typeof text === 'string' ? text : '';
}

async function sendViaLiveChatCompletion(context, settings, messages, { signal = null } = {}) {
    const service = context.ChatCompletionService;
    const live = context.chatCompletionSettings || {};
    const maxTokens = resolveStateRequestMaxTokens(settings, context);
    return service.processRequest({
        stream: true,
        messages,
        max_tokens: maxTokens,
        model: liveChatCompletionModel(live),
        chat_completion_source: live.chat_completion_source,
        custom_url: live.custom_url,
        reverse_proxy: live.reverse_proxy,
        proxy_password: live.proxy_password,
        vertexai_region: live.vertexai_region,
        zai_endpoint: live.zai_endpoint,
        siliconflow_endpoint: live.siliconflow_endpoint,
        minimax_endpoint: live.minimax_endpoint,
    }, {
        presetName: settings.completionPresetId || undefined,
    }, true, signal);
}

// ── Combat Main-Profile Auto-Switch ────────────────────────────────────────────

const MAIN_PROFILE_NONE = '<None>';

/** @type {string|null} Profile name to restore when combat ends. */
let _combatBaselineProfileName = null;
/** @type {string|null} Preset name to restore when combat ends. */
let _combatBaselinePresetName = null;
/** @type {boolean} Whether the extension currently owns a combat profile override. */
let _combatProfileOverrideActive = false;
/** @type {Promise<void>|null} Serializes concurrent profile switches. */
let _combatProfileSwitchChain = null;

/** Returns true when the memo contains an active (non-empty, non-END_COMBAT) [COMBAT] block. */
export function isCombatActive(memo) {
    if (!memo) return false;
    const match = memo.match(/\[COMBAT\]([\s\S]*?)\[\/COMBAT\]/i);
    if (!match) return false;
    const body = match[1].trim();
    return body.length > 0 && !/^END_COMBAT$/i.test(body);
}

function escapeSlashArg(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getProfileNameById(profileId) {
    if (!profileId) return null;
    try {
        const ctx = SillyTavern.getContext();
        const service = ctx.ConnectionManagerRequestService;
        if (service?.getProfile) {
            return service.getProfile(profileId)?.name ?? null;
        }
        const profiles = ctx.extensionSettings?.connectionManager?.profiles || [];
        return profiles.find(p => p.id === profileId)?.name ?? null;
    } catch {
        return null;
    }
}

/** Returns the name of the currently active main ST connection profile, or null for None. */
export async function getCurrentMainProfileName() {
    if (!(await checkConnectionProfilesActive())) return null;
    const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
    const result = await executeSlashCommandsWithOptions('/profile');
    const name = result?.pipe?.trim();
    if (!name || name === MAIN_PROFILE_NONE) return null;
    return name;
}

async function switchMainConnectionProfileByName(profileName) {
    if (!(await checkConnectionProfilesActive())) return;
    const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
    const arg = profileName ? escapeSlashArg(profileName) : MAIN_PROFILE_NONE;
    await executeSlashCommandsWithOptions(`/profile "${arg}"`);
}

async function applyCombatOverrides(combatProfileName, combatPresetId) {
    await switchMainConnectionProfileByName(combatProfileName);
    if (combatPresetId) {
        await setCompletionPreset(combatPresetId);
    }
}

async function restoreCombatBaseline(baselineProfile, baselinePreset) {
    await switchMainConnectionProfileByName(baselineProfile);
    if (baselinePreset) {
        await setCompletionPreset(baselinePreset);
    }
}

function combatOverridesMatch(currentProfile, currentPreset, combatProfileName, combatPresetId) {
    if (currentProfile !== combatProfileName) return false;
    if (!combatPresetId) return true;
    return currentPreset === combatPresetId;
}

function runSerializedCombatSwitch(fn) {
    const run = async () => {
        if (_combatProfileSwitchChain) await _combatProfileSwitchChain.catch(() => { });
        await fn();
    };
    _combatProfileSwitchChain = run();
    return _combatProfileSwitchChain;
}

/** Restores the pre-combat main profile if the extension currently owns the override. */
export async function resetCombatProfileOverride(settings) {
    settings = settings || getSettings();
    if (!_combatProfileOverrideActive) return;

    const baseline = _combatBaselineProfileName;
    const baselinePreset = _combatBaselinePresetName;
    _combatProfileOverrideActive = false;
    _combatBaselineProfileName = null;
    _combatBaselinePresetName = null;

    await runSerializedCombatSwitch(async () => {
        try {
            await restoreCombatBaseline(baseline, baselinePreset);
            if (settings.debugMode) {
                console.log(`[RPG Tracker] Combat profile override reset → ${baseline ?? MAIN_PROFILE_NONE}${baselinePreset ? ` / preset: ${baselinePreset}` : ''}`);
            }
        } catch (e) {
            console.warn('[RPG Tracker] Failed to reset combat profile override:', e);
        }
    });
}

/**
 * Switches the main ST connection profile based on [COMBAT] presence in the memo.
 * Called after each narration generation (post State Tracker pass).
 * @param {string} memo
 * @param {ReturnType<import('./state-manager.js').getSettings>} [settings]
 */
export async function syncCombatProfile(memo, settings) {
    settings = settings || getSettings();

    if (!settings.combatProfileAutoSwitch || !settings.enabled || settings.paused) {
        await resetCombatProfileOverride(settings);
        return;
    }

    if (!(await checkConnectionProfilesActive())) return;

    const combatProfileId = settings.combatConnectionProfileId;
    if (!combatProfileId) return;

    const combatProfileName = getProfileNameById(combatProfileId);
    if (!combatProfileName) return;

    const combatPresetId = String(settings.combatCompletionPresetId || '').trim();
    const combatActive = isCombatActive(memo);

    await runSerializedCombatSwitch(async () => {
        try {
            const currentName = await getCurrentMainProfileName();
            const currentPreset = await getCurrentCompletionPreset();

            if (combatActive) {
                if (!_combatProfileOverrideActive) {
                    if (combatOverridesMatch(currentName, currentPreset, combatProfileName, combatPresetId)) return;
                    _combatBaselineProfileName = currentName;
                    _combatBaselinePresetName = currentPreset;
                    _combatProfileOverrideActive = true;
                    await applyCombatOverrides(combatProfileName, combatPresetId);
                    if (settings.debugMode) {
                        console.log(`[RPG Tracker] Combat profile activated: ${combatProfileName}${combatPresetId ? ` / preset: ${combatPresetId}` : ''} (baseline: ${_combatBaselineProfileName ?? MAIN_PROFILE_NONE}${_combatBaselinePresetName ? ` / ${_combatBaselinePresetName}` : ''})`);
                    }
                } else if (!combatOverridesMatch(currentName, currentPreset, combatProfileName, combatPresetId)) {
                    await applyCombatOverrides(combatProfileName, combatPresetId);
                    if (settings.debugMode) {
                        console.log(`[RPG Tracker] Re-applied combat profile: ${combatProfileName}${combatPresetId ? ` / preset: ${combatPresetId}` : ''}`);
                    }
                }
                return;
            }

            if (!_combatProfileOverrideActive) return;

            const baseline = _combatBaselineProfileName;
            const baselinePreset = _combatBaselinePresetName;
            _combatProfileOverrideActive = false;
            _combatBaselineProfileName = null;
            _combatBaselinePresetName = null;

            if (!combatOverridesMatch(currentName, currentPreset, baseline, baselinePreset || null)) {
                await restoreCombatBaseline(baseline, baselinePreset);
                if (settings.debugMode) {
                    console.log(`[RPG Tracker] Combat ended — restored profile: ${baseline ?? MAIN_PROFILE_NONE}${baselinePreset ? ` / preset: ${baselinePreset}` : ''}`);
                }
            }
        } catch (e) {
            console.warn('[RPG Tracker] Combat profile sync failed:', e);
        }
    });
}

// ── CORS Proxy Helpers ─────────────────────────────────────────────────────────

function proxiedUrl(url, useProxy = true) {
    if (!useProxy) return url;
    return `/proxy/${url}`;
}

function getProxyHeaders() {
    try {
        const ctx = SillyTavern.getContext();
        if (typeof ctx.getRequestHeaders === 'function') {
            return ctx.getRequestHeaders();
        }
    } catch (e) { /* fallback */ }
    return { 'Content-Type': 'application/json' };
}

// ── Ollama ─────────────────────────────────────────────────────────────────────

export async function sendViaOllama(url, model, systemPrompt, userPrompt, maxTokens, presetSettings = {}, signal = null, jsonSchema = null, stream = false) {
    if (!url) throw new Error('Ollama URL is not configured.');
    if (!model) throw new Error('Ollama model is not selected.');

    const baseUrl = url.replace(/\/+$/, '');
    const targetUrl = `${baseUrl}/api/chat`;

    const requestBody = {
        model: model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        stream: !!stream,
        options: {
            temperature: presetSettings.temperature ?? presetSettings.temp ?? presetSettings.temp_openai ?? 0.1,
            top_p: presetSettings.top_p ?? presetSettings.top_p_openai ?? 1.0,
            top_k: presetSettings.top_k ?? presetSettings.top_k_openai ?? 40,
            repeat_penalty: presetSettings.repetition_penalty ?? presetSettings.rep_pen ?? presetSettings.repetition_penalty_openai ?? 1.1,
            num_predict: (maxTokens && maxTokens > 0) ? maxTokens : undefined,
        },
    };
    if (jsonSchema?.value) requestBody.format = jsonSchema.value;
    console.log(`[RPG Tracker] sendViaOllama — model: "${model}", url: "${targetUrl}"`);
    if (Object.keys(presetSettings).length > 0) console.log(`[RPG Tracker] Applied Preset Data:`, presetSettings);
    console.log(`[RPG Tracker] Parameters — Temp: ${requestBody.options.temperature}, Top_P: ${requestBody.options.top_p}, Top_K: ${requestBody.options.top_k}`);
    console.log(`[RPG Tracker] Prompts — System: "${systemPrompt.substring(0, 50)}...", User: "${userPrompt.substring(0, 50)}..."`);

    let response;
    const headers = { 'Content-Type': 'application/json' };
    try {
        const proxyHeaders = getProxyHeaders();
        const finalHeaders = { ...headers, ...proxyHeaders };
        response = await fetch(proxiedUrl(targetUrl), {
            method: 'POST',
            headers: finalHeaders,
            body: JSON.stringify(requestBody),
            signal,
        });
        if (!response.ok && response.status === 404) {
            throw new Error('Proxy 404');
        }
    } catch (proxyError) {
        try {
            response = await fetch(targetUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                signal,
            });
        } catch (directError) {
            throw new Error(`Failed to connect to Ollama. Proxy error: ${proxyError.message}. Direct error: ${directError.message}`);
        }
    }

    if (!response.ok) {
        if (response.status === 401) throw new Error('Ollama returned 401 Unauthorized. Check that no authentication is required, or configure it correctly.');
        throw new Error(`Ollama request failed (${response.status})`);
    }
    if (!stream) {
        const data = await response.json();
        const result = data.message.content;
        console.log(`[RPG Tracker] Response from Ollama: "${String(result || '').substring(0, 100)}..."`);
        return result;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const parsed = JSON.parse(trimmed);
                    const piece = parsed.message?.content;
                    if (piece) fullContent += piece;
                } catch (_) { /* ignore keep-alive / partial lines */ }
            }
        }
    } finally {
        reader.releaseLock();
    }
    if (!fullContent.trim()) throw new Error('Ollama returned an empty response.');
    console.log(`[RPG Tracker] Response from Ollama: "${fullContent.substring(0, 100)}..."`);
    return fullContent;
}

export async function fetchOllamaModels(url) {
    if (!url) throw new Error('Ollama URL is not configured.');
    const baseUrl = url.replace(/\/+$/, '');
    const targetUrl = `${baseUrl}/api/tags`;
    let response;
    try {
        const proxyHeaders = getProxyHeaders();
        response = await fetch(proxiedUrl(targetUrl), { method: 'GET', headers: proxyHeaders });
        if (!response.ok && response.status === 404) {
            response = await fetch(targetUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        }
    } catch (e) {
        response = await fetch(targetUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    }
    if (!response.ok) {
        if (response.status === 401) throw new Error('Ollama returned 401 Unauthorized. Check that no authentication is required.');
        throw new Error(`Failed to fetch Ollama models (${response.status})`);
    }
    const data = await response.json();
    return data.models || [];
}

// ── OpenAI Compatible ──────────────────────────────────────────────────────────

export async function sendViaOpenAI(url, apiKey, model, systemPrompt, userPrompt, maxTokens, presetSettings = {}, signal = null, jsonSchema = null) {
    if (!url) throw new Error('OpenAI Compatible URL is not configured.');
    if (!model) throw new Error('OpenAI Compatible model name is not set.');

    const baseUrl = url.replace(/\/+$/, '');
    let endpoint = baseUrl;
    if (!endpoint.endsWith('/chat/completions')) {
        if (endpoint.endsWith('/v1')) endpoint += '/chat/completions';
        else if (!endpoint.includes('/chat/completions')) endpoint += '/v1/chat/completions';
    }

    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?/i.test(endpoint);
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const requestBody = {
        model: model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: presetSettings.temperature ?? presetSettings.temp ?? presetSettings.temp_openai ?? 0.1,
        top_p: presetSettings.top_p ?? presetSettings.top_p_openai ?? 1.0,
        frequency_penalty: presetSettings.frequency_penalty ?? presetSettings.freq_pen ?? presetSettings.freq_pen_openai ?? 0,
        presence_penalty: presetSettings.presence_penalty ?? presetSettings.presence_pen ?? presetSettings.pres_pen_openai ?? 0,
        stream: true,
    };
    if (maxTokens && maxTokens > 0) requestBody.max_tokens = maxTokens;
    if (jsonSchema?.value) {
        requestBody.response_format = {
            type: 'json_schema',
            json_schema: {
                name: jsonSchema.name || 'structured_response',
                description: jsonSchema.description,
                schema: jsonSchema.value,
                strict: jsonSchema.strict ?? false,
            },
        };
    }

    console.log(`[RPG Tracker] sendViaOpenAI — model: "${model}", url: "${endpoint}"`);
    if (Object.keys(presetSettings).length > 0) console.log(`[RPG Tracker] Applied Preset Data:`, presetSettings);
    console.log(`[RPG Tracker] Parameters — Temp: ${requestBody.temperature}, Top_P: ${requestBody.top_p}, Freq_Pen: ${requestBody.frequency_penalty}`);
    console.log(`[RPG Tracker] Prompts — System: "${systemPrompt.substring(0, 50)}...", User: "${userPrompt.substring(0, 50)}..."`);

    let response;
    if (isLocal) {
        try {
            const proxyHeaders = getProxyHeaders();
            const finalHeaders = { ...headers, ...proxyHeaders };
            response = await fetch(proxiedUrl(endpoint), { method: 'POST', headers: finalHeaders, body: JSON.stringify(requestBody), signal });
            if (!response.ok && response.status === 404) {
                throw new Error('Proxy 404');
            }
        } catch (e) {
            response = await fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(requestBody), credentials: 'omit', signal });
        }
    } else {
        response = await fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(requestBody), credentials: 'omit', signal });
    }

    if (!response.ok) {
        if (response.status === 401) throw new Error('OpenAI endpoint returned 401 Unauthorized. Check your API key.');
        throw new Error(`OpenAI request failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) fullContent += delta;
                } catch (e) { }
            }
        }
    } finally { reader.releaseLock(); }

    if (!fullContent.trim()) throw new Error('OpenAI returned an empty response.');
    console.log(`[RPG Tracker] Response from OpenAI: "${fullContent.substring(0, 100)}..."`);
    return fullContent;
}

export async function fetchOpenAIModels(url, apiKey) {
    if (!url) throw new Error('OpenAI URL is not configured.');
    const baseUrl = url.replace(/\/+$/, '');
    let endpoint = baseUrl;
    if (!endpoint.endsWith('/models')) {
        if (endpoint.endsWith('/v1')) endpoint += '/models';
        else if (!endpoint.includes('/models')) endpoint += '/v1/models';
    }

    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?/i.test(endpoint);
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    if (isLocal) {
        try {
            const proxyHeaders = getProxyHeaders();
            const finalHeaders = { ...headers, ...proxyHeaders };
            const proxyResponse = await fetch(proxiedUrl(endpoint), { method: 'GET', headers: finalHeaders });
            if (proxyResponse.ok) {
                const data = await proxyResponse.json();
                return data.data || data.models || [];
            }
        } catch (e) { /* proxy network error, fall through */ }
    }

    try {
        const directResponse = await fetch(endpoint, {
            method: 'GET',
            headers: headers,
            credentials: 'omit',
        });
        if (directResponse.ok) {
            const data = await directResponse.json();
            return data.data || data.models || [];
        }
        if (directResponse.status === 401) {
            throw new Error('Endpoint returned 401 Unauthorized. Check your API key.');
        }
        throw new Error(`HTTP ${directResponse.status}`);
    } catch (e) {
        if (e.message.includes('401')) throw e;
        if (isLocal) {
            throw new Error(
                `Cannot reach ${endpoint} due to CORS restrictions.\n\n` +
                `Solutions:\n` +
                `1. Enable ST's CORS proxy: set "enableCorsProxy: true" in config.yaml and restart ST.\n` +
                `2. Or type the model name manually in the text box below.\n\n` +
                `(Original error: ${e.message})`
            );
        }
        throw e;
    }
}

export async function testOpenAIConnection(url, apiKey, model) {
    try {
        const result = await sendViaOpenAI(url, apiKey, model || 'test', 'You are a test assistant.', 'Respond with exactly: CONNECTION_OK', 100);
        return { success: true, message: `Connection successful! Response: "${result.substring(0, 100)}"` };
    } catch (error) {
        return { success: false, message: `Connection failed: ${error.message}` };
    }
}

function responsePartText(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        return value.map(part => {
            if (typeof part === 'string') return part;
            return part?.text ?? part?.content ?? '';
        }).filter(Boolean).join('\n');
    }
    if (value && typeof value === 'object') return JSON.stringify(value);
    return '';
}

/** Extract provider output without SillyTavern's dialogue cleanup layer. */
function extractRawStateResponse(context, raw) {
    if (typeof raw === 'string') return raw.trim();

    let extracted = '';
    try {
        extracted = responsePartText(context.extractMessageFromData?.(raw, context.mainApi));
    } catch (_) { /* use provider-shape fallbacks below */ }
    if (extracted.trim()) return extracted.trim();

    const finalCandidates = [
        raw?.choices?.[0]?.message?.content,
        raw?.choices?.[0]?.text,
        raw?.message?.content,
        raw?.content,
        raw?.response,
        raw?.text,
        raw?.output,
        raw?.responseContent?.parts,
    ];
    for (const candidate of finalCandidates) {
        const text = responsePartText(candidate).trim();
        if (text) return text;
    }

    // Some reasoning models put their only usable payload in a reasoning field.
    // The caller still parses and validates it as a map before persistence.
    const reasoningCandidates = [
        raw?.choices?.[0]?.message?.reasoning_content,
        raw?.choices?.[0]?.message?.reasoning,
        raw?.message?.reasoning_content,
        raw?.message?.reasoning,
        raw?.reasoning_content,
        raw?.reasoning,
    ];
    for (const candidate of reasoningCandidates) {
        const text = responsePartText(candidate).trim();
        if (text) return text;
    }
    return '';
}

// ── Primary dispatch ───────────────────────────────────────────────────────────

/**
 * Routes a state request to the correct backend based on settings.connectionSource.
 * Handles: 'profile', 'ollama', 'openai', 'default' (generateRaw).
 * @param {ReturnType<import('./state-manager.js').getSettings>} settings
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {AbortSignal|null} [signal]
 * @param {{ preserveUserMacro?: boolean, userMacroNames?: string[], jsonSchema?: object|null, stream?: boolean, debugSource?: string }} [options]
 * @returns {Promise<string>}
 */
export async function sendStateRequest(settings, systemPrompt, userPrompt, signal = null, options = {}) {
    const preserveUserMacro = !!options.preserveUserMacro;
    const userMacroNames = options.userMacroNames || [];
    const jsonSchema = options.jsonSchema || null;
    const stream = !!options.stream;
    const debugSource = String(options.debugSource || 'Tracker').trim() || 'Tracker';
    const finalize = (text) => (preserveUserMacro && typeof text === 'string')
        ? restoreUserMacro(text, userMacroNames)
        : text;
    if (preserveUserMacro) {
        systemPrompt = shieldUserMacro(systemPrompt);
        userPrompt = shieldUserMacro(userPrompt);
    }

    const context = SillyTavern.getContext();
    const maxTokens = resolveStateRequestMaxTokens(settings, context);

    const activeProfileId = settings.connectionSource === 'profile' ? (settings.connectionProfileId || '') : '(inactive)';
    console.log(`[RPG Tracker] sendStateRequest — source: "${settings.connectionSource}", profileId: "${activeProfileId}", preset: "${settings.completionPresetId}"`);

    // ── Profile mode: use ConnectionManagerRequestService (silent, no UI flicker) ──
    if (settings.connectionSource === 'profile' && settings.connectionProfileId) {
        const service = context.ConnectionManagerRequestService;

        if (!service || typeof service.sendRequest !== 'function') {
            console.warn('[RPG Tracker] ConnectionManagerRequestService not available (ST too old?). Falling back to generateRaw with profile switch.');
        } else {
            if (settings.debugMode) console.log(`[RPG Tracker] Sending via profile (silent): ${settings.connectionProfileId}${settings.completionPresetId ? `, preset override: ${settings.completionPresetId}` : ''}`);

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt   },
            ];

            // Never send provider-level json_schema here. Many Chat Completion
            // profiles (custom OpenAI-compatible, OpenRouter, Claude, local
            // proxies) 404/400 on structured-output endpoints. Map Architect
            // already parses and validates the text itself; jsonSchema on this
            // function is only a signal for the Main API generateRawData path.
            const raw = await sendViaConnectionProfile(context, settings, messages, { signal, stream });
            let text = await collectCompletionText(raw);
            if (typeof text === 'string' && text.trim().startsWith('{') && text.trim().endsWith('}')) {
                try {
                    const parsed = JSON.parse(text);
                    const nested = parsed.content
                        ?? parsed.message?.content
                        ?? parsed.choices?.[0]?.message?.content
                        ?? parsed.choices?.[0]?.text;
                    if (typeof nested === 'string' && nested) text = nested;
                    else if (nested && typeof nested === 'object') text = JSON.stringify(nested);
                } catch (_) { /* keep streamed / raw text */ }
            }
            if (typeof text === 'string') {
                logTransaction(debugSource, [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], text);
                return finalize(text);
            }
            throw new Error(`[RPG Tracker] Profile request returned unexpected type: ${JSON.stringify(raw).substring(0, 200)}`);
        }
    }

    // Helper: resolve preset settings from the active preset manager
    const getPresetData = () => {
        if (!settings.completionPresetId) return {};
        let manager = context.getPresetManager();
        let data = manager ? manager.getCompletionPresetByName(settings.completionPresetId) : null;
        if (!data) {
            manager = context.getPresetManager('textgenerationwebui');
            data = manager ? manager.getCompletionPresetByName(settings.completionPresetId) : null;
        }
        if (!data) {
            manager = context.getPresetManager('openai');
            data = manager ? manager.getCompletionPresetByName(settings.completionPresetId) : null;
        }
        if (!data && settings.debugMode) console.warn(`[RPG Tracker] Preset "${settings.completionPresetId}" not found in common PresetManagers.`);
        return data || {};
    };
    const presetSettings = getPresetData();

    // ── Ollama Mode ──
    if (settings.connectionSource === 'ollama') {
        if (settings.debugMode) console.log(`[RPG Tracker] Sending via Ollama: ${settings.ollamaModel}`);
        const text = await sendViaOllama(settings.ollamaUrl, settings.ollamaModel, systemPrompt, userPrompt, maxTokens, presetSettings, signal, null, stream);
        logTransaction(debugSource, [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], text);
        return finalize(text);
    }

    // ── OpenAI Compatible Mode ──
    if (settings.connectionSource === 'openai') {
        if (settings.debugMode) console.log(`[RPG Tracker] Sending via OpenAI Compatible: ${settings.openaiModel}`);
        const text = await sendViaOpenAI(settings.openaiUrl, settings.openaiKey, settings.openaiModel, systemPrompt, userPrompt, maxTokens, presetSettings, signal, null);
        logTransaction(debugSource, [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], text);
        return finalize(text);
    }

    // ── Default mode: generateRaw through the active connection ──
    // ST quiet generations never stream (`type !== 'quiet'`). Long Map Architect /
    // Map Evolution / tracker jobs would sit silent until OpenRouter / nano-gpt
    // idle-cut the HTTP wait (~60s) even though the model later finishes.
    if (stream && context.mainApi === 'openai' && typeof context.ChatCompletionService?.processRequest === 'function') {
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];
        const raw = await sendViaLiveChatCompletion(context, settings, messages, { signal });
        const text = await collectCompletionText(raw);
        if (!text) throw new Error('Main API returned no usable response content.');
        logTransaction(debugSource, [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], text);
        return finalize(text);
    }

    const { generateRaw } = context;
    if (!generateRaw && !(jsonSchema && typeof context.generateRawData === 'function')) {
        throw new Error('[RPG Tracker] Neither generateRaw nor generateRawData is available.');
    }

    let originalPreset = null;
    try {
        if (settings.completionPresetId) {
            originalPreset = await getCurrentCompletionPreset();
            if (settings.debugMode) console.log(`[RPG Tracker] Switching Preset: ${originalPreset} -> ${settings.completionPresetId}`);
            await setCompletionPreset(settings.completionPresetId);
        }

        const options = {
            prompt: userPrompt,
            systemPrompt: systemPrompt,
            bypassAll: true,
            // We parse this output ourselves (memo/character-sheet extraction), not display it as
            // chat dialogue. ST's default cleanUpMessage(trimNames: true) silently DELETES THE
            // ENTIRE RESPONSE if it happens to start with "{{user}}:" or "{{char}}:" (e.g. a
            // structured character sheet that opens with the generated name, which is common when
            // Character Creator's "Create SillyTavern Persona" option sets {{user}} to that same
            // name) — surfacing as an opaque "No message generated" error. Disable it here.
            trimNames: false,
            signal,
            // SillyTavern's built-in structured-output extraction currently
            // supports Chat Completion here. Other Main API types still use the
            // prompt contract plus Map Architect's runtime validator.
            jsonSchema: context.mainApi === 'openai' ? jsonSchema : null,
        };

        if (maxTokens) {
            options.responseLength = maxTokens;
        }

        let result;
        if (jsonSchema && typeof context.generateRawData === 'function') {
            // Map Architect already owns parsing, validation, and correction.
            // Read the untouched provider response so unsupported response_format
            // schemas cannot cause HTTP 400 and ST cleanup cannot erase the JSON.
            const raw = await context.generateRawData({ ...options, jsonSchema: null });
            result = extractRawStateResponse(context, raw);
            if (!result) throw new Error('Main API returned no usable response content.');
        } else {
            result = await generateRaw(options);
        }

        let text = "";
        if (typeof result === 'string') {
            let parsed = null;
            if (result.trim().startsWith('{') && result.trim().endsWith('}')) {
                try { parsed = JSON.parse(result); } catch (_) { }
            }
            if (parsed) {
                text = parsed.choices?.[0]?.message?.content
                    ?? parsed.choices?.[0]?.text
                    ?? parsed.message?.content
                    ?? parsed.content
                    ?? result;
            } else {
                text = result;
            }
        } else {
            const r = /** @type {any} */ (result);
            text = r?.choices?.[0]?.message?.content
                ?? r?.choices?.[0]?.text
                ?? r?.message?.content
                ?? r?.content
                ?? JSON.stringify(result);
        }

        logTransaction(debugSource, [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], text);
        return finalize(text);

    } catch (err) {
        console.error('[RPG Tracker] Request failed:', err);
        throw err;
    } finally {
        if (originalPreset && settings.completionPresetId && originalPreset !== settings.completionPresetId) {
            if (settings.debugMode) console.log(`[RPG Tracker] Restoring preset: ${originalPreset}`);
            await setCompletionPreset(originalPreset);
        }
    }
}

// ── Agent Turn (multi-turn + native tool calling) ─────────────────────────────

/**
 * Sends one turn of the agent loop.
 *
 * For openai / ollama connections: sends a proper multi-turn messages[] array
 * with native OpenAI-format tools so the model returns structured tool_calls —
 * zero regex parsing.
 *
 * For profile / default connections: sends the same multi-turn messages array
 * but without tools (profile handles its own API routing). The caller is still
 * responsible for text-fallback parsing if needed, but since each call only
 * covers the current turn the model will never echo prior turns, making even
 * simple regex reliable.
 *
 * @param {ReturnType<import('./state-manager.js').getSettings>} settings
 * @param {Array<{role:string, content:string|null, tool_calls?:any[], tool_call_id?:string}>} messages
 * @param {Array<object>|null} tools   OpenAI-format tool schemas, or null to skip tool calling.
 * @param {AbortSignal|null} signal
 * @returns {Promise<{content: string, toolCall: {name: string, args: object, id: string} | null}>}
 */
export async function sendAgentTurn(settings, messages, tools = null, signal = null) {
    const context = SillyTavern.getContext();
    const maxTokens = resolveStateRequestMaxTokens(settings, context);

    // ── OpenAI compatible ────────────────────────────────────────────────────
    if (settings.connectionSource === 'openai') {
        const url = settings.openaiUrl;
        const apiKey = settings.openaiKey;
        const model = settings.openaiModel;
        if (!url) throw new Error('OpenAI Compatible URL is not configured.');
        if (!model) throw new Error('OpenAI Compatible model name is not set.');

        const baseUrl = url.replace(/\/+$/, '');
        let endpoint = baseUrl;
        if (!endpoint.endsWith('/chat/completions')) {
            if (endpoint.endsWith('/v1')) endpoint += '/chat/completions';
            else if (!endpoint.includes('/chat/completions')) endpoint += '/v1/chat/completions';
        }

        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const presetSettings = _getPresetData(settings, context);

        const body = {
            model,
            messages,
            temperature: presetSettings.temperature ?? presetSettings.temp ?? presetSettings.temp_openai ?? 0.1,
            top_p: presetSettings.top_p ?? presetSettings.top_p_openai ?? 1.0,
            stream: false,
        };
        if (tools?.length) body.tools = tools;
        if (maxTokens) body.max_tokens = maxTokens;

        // PATCH: always route through ST's server-side CORS proxy (requires enableCorsProxy).
        // Browser-direct fetches to remote endpoints (e.g. opencode.ai) fail CORS preflight.
        let resp;
        try {
            resp = await fetch(proxiedUrl(endpoint), { method: 'POST', headers: { ...headers, ...getProxyHeaders() }, body: JSON.stringify(body), signal });
            if (!resp.ok && resp.status === 404) throw new Error('proxy 404');
        } catch (_) {
            resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'omit', signal });
        }
        if (!resp.ok) {
            let _body = '';
            try { _body = await resp.text(); } catch (_) {}
            throw new Error(`OpenAI request failed (${resp.status}): ${_body.slice(0, 600)}`);
        }
        const data = await resp.json();
        const msg = data.choices?.[0]?.message;
        const _reasoning = msg?.reasoning_content ?? msg?.reasoning ?? null;
        if (msg?.tool_calls?.length) {
            const tc = msg.tool_calls[0];
            const rawArguments = tc.function.arguments;
            const { args, argumentError } = parseToolCallArguments(rawArguments);
            return { content: msg.content || '', reasoning: _reasoning, toolCall: { name: tc.function.name, args, id: tc.id, argumentError, rawArguments } };
        }
        const text = msg?.content ?? data.choices?.[0]?.text ?? '';
        return { content: text, reasoning: _reasoning, toolCall: null };
    }

    // ── Ollama ───────────────────────────────────────────────────────────────
    if (settings.connectionSource === 'ollama') {
        const baseUrl = (settings.ollamaUrl || '').replace(/\/+$/, '');
        const model = settings.ollamaModel;
        if (!baseUrl) throw new Error('Ollama URL is not configured.');
        if (!model) throw new Error('Ollama model is not selected.');

        const targetUrl = `${baseUrl}/api/chat`;
        const presetSettings = _getPresetData(settings, context);

        const body = {
            model,
            messages,
            stream: false,
            options: {
                temperature: presetSettings.temperature ?? presetSettings.temp ?? 0.1,
                top_p: presetSettings.top_p ?? 1.0,
                num_predict: maxTokens,
            },
        };
        if (tools?.length) body.tools = tools;

        let resp;
        try {
            resp = await fetch(proxiedUrl(targetUrl), { method: 'POST', headers: { ...{ 'Content-Type': 'application/json' }, ...getProxyHeaders() }, body: JSON.stringify(body), signal });
            if (!resp.ok && resp.status === 404) throw new Error('proxy 404');
        } catch (_) {
            resp = await fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
        }
        if (!resp.ok) throw new Error(`Ollama request failed (${resp.status})`);
        const data = await resp.json();
        const msg = data.message;
        if (msg?.tool_calls?.length) {
            const tc = msg.tool_calls[0];
            const rawArguments = tc.function?.arguments ?? {};
            const { args, argumentError } = parseToolCallArguments(rawArguments);
            return { content: msg.content || '', toolCall: { name: tc.function.name, args, id: `call_${Date.now()}`, argumentError, rawArguments } };
        }
        return { content: msg?.content ?? '', toolCall: null };
    }

    // ── Profile (ConnectionManagerRequestService) ────────────────────────────
    if (settings.connectionSource === 'profile' && settings.connectionProfileId) {
        const service = context.ConnectionManagerRequestService;
        if (service && typeof service.sendRequest === 'function') {
            // Do NOT pass tools to the profile service — ConnectionManagerRequestService
            // does not reliably forward them to all API backends, causing MALFORMED_FUNCTION_CALL
            // errors. The router uses a text-format fallback for profile connections.
            const raw = await sendViaConnectionProfile(context, settings, messages, { signal });
            if (typeof raw === 'string') return { content: raw, toolCall: null };
            const r = /** @type {any} */ (raw);
            // Check for native tool_calls first
            const tc = r?.choices?.[0]?.message?.tool_calls?.[0] ?? r?.tool_calls?.[0] ?? null;
            if (tc) {
                const rawArguments = tc.function?.arguments ?? {};
                const { args, argumentError } = parseToolCallArguments(rawArguments);
                return { content: r?.choices?.[0]?.message?.content || '', toolCall: { name: tc.function.name, args, id: tc.id || `call_${Date.now()}`, argumentError, rawArguments } };
            }
            let text = r?.content
                ?? r?.message?.content
                ?? r?.choices?.[0]?.message?.content
                ?? r?.choices?.[0]?.text
                ?? null;

            if (text === null || text === undefined || text === '') {
                text = r?.reasoning
                    ?? r?.message?.reasoning
                    ?? r?.choices?.[0]?.message?.reasoning
                    ?? text;
            }

            if (typeof text === 'string') return { content: text, toolCall: null };
            throw new Error(`[RPG Tracker] Profile agent turn returned unexpected type: ${JSON.stringify(raw).substring(0, 200)}`);
        }
    }

    // ── Default (generateRaw fallback) ───────────────────────────────────────
    const { generateRaw } = context;
    if (!generateRaw) throw new Error('[RPG Tracker] generateRaw is not available.');

    // Reconstruct flat prompts from messages array for generateRaw
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');
    const flatUser = nonSystem.map(m => {
        if (m.role === 'tool') return `Observation: ${m.content}`;
        if (m.role === 'assistant' && m.tool_calls) return `Action: ${m.tool_calls[0]?.function?.name}(${m.tool_calls[0]?.function?.arguments})`;
        return m.content || '';
    }).join('\n\n');

    let originalPreset2 = null;
    try {
        if (settings.completionPresetId) {
            originalPreset2 = await getCurrentCompletionPreset();
            await setCompletionPreset(settings.completionPresetId);
        }
        const options = { prompt: flatUser, systemPrompt: systemMsg?.content || '', bypassAll: true, signal };
        if (maxTokens) options.responseLength = maxTokens;
        const result = await generateRaw(options);
        const text = typeof result === 'string' ? result : (/** @type {any} */ (result))?.choices?.[0]?.message?.content ?? '';
        return { content: text, toolCall: null };
    } finally {
        if (originalPreset2 && settings.completionPresetId && originalPreset2 !== settings.completionPresetId) {
            await setCompletionPreset(originalPreset2);
        }
    }
}

/** Internal: resolve preset settings by name from the active preset manager. */
function _getPresetData(settings, context) {
    if (!settings.completionPresetId) return {};
    for (const type of [undefined, 'textgenerationwebui', 'openai']) {
        const mgr = context.getPresetManager(type);
        const data = mgr?.getCompletionPresetByName(settings.completionPresetId);
        if (data) return data;
    }
    return {};
}
