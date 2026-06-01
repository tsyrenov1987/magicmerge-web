/**
 * Lily dialogue — message pool + queue store.
 *
 * Phase 2.C: short bubble messages above the game area, triggered by
 * gameplay events (greet, merge, attention hint, sleepy). Messages are
 * localized triples [ru, en, es] mirroring iOS Res.t shape.
 *
 * One active message at a time. New messages preempt the active one,
 * with a small dedupe window so we don't spam (e.g. fast-chain merges
 * only say "Nice!" once every ~1.5s).
 */

import { writable } from "svelte/store";
import { get } from "svelte/store";
import { locale, tt } from "$lib/i18n";

export type DialogueCategory =
  | "greeting"
  | "hint"
  | "praise"
  | "combo"
  | "chain"
  | "jackpot"
  | "sleepy"
  | "no-energy";

type LocalizedTriple = [string, string, string];

/**
 * Message pools — pick a random line per trigger so Lily doesn't repeat
 * herself. Source content is hand-written EN, RU, ES; will be expanded as
 * we port the 27 iOS lore episodes in 2.D.
 */
const POOL: Record<DialogueCategory, LocalizedTriple[]> = {
  greeting: [
    ["Привет! Слияния ждут ✨", "Hi! Let's merge ✨", "¡Hola! A fusionar ✨"],
    ["Я тут, рядом 🧚‍♀️", "I'm right here 🧚‍♀️", "Aquí estoy 🧚‍♀️"],
    ["Тапни генератор — и поехали!", "Tap the generator to start!", "¡Toca el generador y empieza!"],
    ["Доброе утро 💖", "Good to see you 💖", "Qué bueno verte 💖"],
  ],
  hint: [
    ["Попробуй слить эти!", "Try merging these!", "¡Fusiona estos!"],
    ["Здесь есть пара ✨", "There's a pair here ✨", "Hay un par aquí ✨"],
    ["Соедини их 💫", "Match them up 💫", "Únelos 💫"],
    ["Смотри внимательно — пара рядом", "Look — there's a match", "Mira, hay un par cerca"],
  ],
  praise: [
    ["Красиво!", "Lovely!", "¡Precioso!"],
    ["Ещё! ✨", "Again! ✨", "¡Otra! ✨"],
    ["Так держать", "Keep going", "Sigue así"],
    ["Слияние 💖", "Merged 💖", "¡Fusión! 💖"],
    ["Чудесно", "Wonderful", "Maravilloso"],
    ["Точно в цель", "Right on", "¡Perfecto!"],
  ],
  combo: [
    ["Комбо! ⚡", "Combo! ⚡", "¡Combo! ⚡"],
    ["Не останавливайся!", "Don't stop!", "¡No pares!"],
    ["Цепочка пошла ✨", "Chain's on fire ✨", "¡Cadena encendida! ✨"],
  ],
  chain: [
    ["Каскад! 🌟", "Cascade! 🌟", "¡Cascada! 🌟"],
    ["Ого, какой каскад", "Whoa, a cascade!", "¡Vaya, qué cascada!"],
    ["Они посыпались! ✨", "They tumbled together! ✨", "¡Cayeron en cadena! ✨"],
  ],
  jackpot: [
    ["Джекпот! 🎁", "Jackpot! 🎁", "¡Premio gordo! 🎁"],
    ["Невероятно!", "Incredible!", "¡Increíble!"],
    ["Два сундука — это сокровище 💎", "Two chests — that's a treasure 💎", "Dos cofres — ¡un tesoro! 💎"],
  ],
  sleepy: [
    ["Я задремала… 💤", "Drifting off… 💤", "Me estoy durmiendo… 💤"],
    ["Здесь так тихо…", "It's so quiet…", "Qué tranquilidad…"],
    ["Тссс… 🌙", "Shhh… 🌙", "Shhh… 🌙"],
  ],
  "no-energy": [
    ["Энергия кончилась — подожди немного 🌙", "Out of energy — rest a bit 🌙", "Sin energía — descansa un poco 🌙"],
    ["Нужно отдохнуть ⚡", "Time to rest ⚡", "Hora de descansar ⚡"],
  ],
};

export interface DialogueMessage {
  /** Unique id so the renderer can keyed-transition between messages */
  id: number;
  category: DialogueCategory;
  text: string;
  /** Auto-dismiss at this timestamp (ms since epoch) */
  expiresAt: number;
}

const HOLD_MS = 2400;
const DEDUPE_MS = 1400;

export const activeMessage = writable<DialogueMessage | null>(null);

let lastCategoryMs: Partial<Record<DialogueCategory, number>> = {};
let nextId = 1;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

/** Push a localized message for the given category. Dedupes within 1.4s. */
export function say(category: DialogueCategory): void {
  const now = Date.now();
  const last = lastCategoryMs[category] ?? 0;
  if (now - last < DEDUPE_MS) return;
  lastCategoryMs[category] = now;

  const pool = POOL[category];
  const triple = pool[Math.floor(Math.random() * pool.length)];
  if (!triple) return;
  const text = tt(get(locale), triple[0], triple[1], triple[2]);

  const message: DialogueMessage = {
    id: nextId++,
    category,
    text,
    expiresAt: now + HOLD_MS,
  };
  activeMessage.set(message);

  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => {
    activeMessage.update((m) => (m && m.id === message.id ? null : m));
  }, HOLD_MS);
}

/** Hide the bubble immediately (e.g. on Back to landing). */
export function clearDialogue(): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  activeMessage.set(null);
  lastCategoryMs = {};
}
