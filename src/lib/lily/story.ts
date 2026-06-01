/**
 * Lore episodes — port of iOS Story.swift (27 entries).
 *
 * Tone: "Fragmented World" / dark cozy fantasy. The world is frozen in
 * the Stasis; the player's merges and garden restorations are small
 * acts of restoration. Three voices:
 *   - lily: hope / playful (the fairy)
 *   - root: grounded / earthy (the elder gardener)
 *   - sage: mystic / mysterious (Saffi the owl)
 *
 * Episodes are unlocked by progression events; each shows ONCE per
 * save. Web build uses localStorage to track seen ids; future Phase 7
 * will sync to Firebase so iOS + TG accounts that link share progress.
 */

import { writable, get } from "svelte/store";
import { locale, tt, type Locale } from "$lib/i18n";

export type StoryCharacter = "lily" | "root" | "sage";
export type StoryMood = "excited" | "playful" | "wise" | "mysterious";

export type StoryEvent =
  | "intro"
  | "first_build"
  | "first_collect"
  | "first_unique"
  | "starter_full"
  | "first_rare"
  | "built_greenhouse"
  | "built_fairy_house"
  | "built_moon_obelisk"
  | "built_fire_tower"
  | "built_crystal_cave"
  | "built_tree_of_life"
  | "built_rainbow_bridge"
  | "mastery_gift"
  | "mastery_pizza"
  | "mastery_rocket"
  | "mastery_unicorn"
  | "mastery_gem"
  | "mastery_guitar"
  | "mastery_dolphin"
  | "mastery_trophy"
  | "mastery_phone"
  | "streak_3"
  | "streak_7"
  | "streak_14"
  | "streak_30"
  | "first_prestige"
  | "first_weekly_claim";

export interface StoryLine {
  character: StoryCharacter;
  mood: StoryMood;
  /** [ru, en, es] */
  title: [string, string, string];
  /** [ru, en, es] */
  body: [string, string, string];
}

/** Character display name [ru, en, es] */
export function characterName(c: StoryCharacter): [string, string, string] {
  switch (c) {
    case "lily": return ["Лили", "Lily", "Lily"];
    case "root": return ["Корень", "Root", "Raíz"];
    case "sage": return ["Сафи", "Saffi", "Saffi"];
  }
}

export function characterEmoji(c: StoryCharacter): string {
  switch (c) {
    case "lily": return "🧚‍♀️";
    case "root": return "🧓";
    case "sage": return "🦉";
  }
}

export function characterEpithet(c: StoryCharacter): [string, string, string] {
  switch (c) {
    case "lily": return ["последний свет", "the last light", "la última luz"];
    case "root": return ["последний садовник", "the last gardener", "el último jardinero"];
    case "sage": return ["эхо, что помнит", "an echo that remembers", "un eco que recuerda"];
  }
}

export const STORY: Record<StoryEvent, StoryLine> = {
  intro: {
    character: "lily", mood: "excited",
    title: ["Первый осколок", "The first shard", "El primer fragmento"],
    body: [
      "Это Сад — то немногое, что Стазис не доглодал до серости. Каждая постройка здесь — кусочек мира, что помнит, как был живым. Коснись пустого участка и дай чему-то начаться вновь.",
      "This is the Garden — one of the few things the Stasis never gnawed down to grey. Every building here is a piece of the world that remembers being alive. Touch an empty plot and let something begin again.",
      "Esto es el Jardín — de lo poco que el Estasis no royó hasta el gris. Cada edificio aquí es un trozo del mundo que recuerda haber estado vivo. Toca una parcela vacía y deja que algo vuelva a empezar.",
    ],
  },
  first_build: {
    character: "lily", mood: "playful",
    title: ["Оно тянется вверх", "It reaches upward", "Se alza hacia arriba"],
    body: [
      "Времени здесь много — Стазис об этом позаботился. Пока постройка зреет, вернись к доске: слияния L5+ будят артефакты, а они нужны для самого хрупкого.",
      "Time is the one thing the Stasis left in plenty. While it grows, return to the board — L5+ merges wake artifacts, and the rarest things here need them.",
      "El tiempo es lo único que el Estasis dejó de sobra. Mientras crece, vuelve al tablero — las fusiones L5+ despiertan artefactos, y lo más raro de aquí los necesita.",
    ],
  },
  first_collect: {
    character: "lily", mood: "excited",
    title: ["Первый отклик", "First yield", "La primera cosecha"],
    body: [
      "Оно отдало тебе свет — монеты, если хочешь звать их так. Постройки делятся по кругу, снова и снова. В мире, что застыл, повторение — уже бунт.",
      "It gave you light back — coins, if you want to call them that. Buildings yield in cycles, again and again. In a world that froze, repetition is its own quiet rebellion.",
      "Te devolvió luz — monedas, si quieres llamarlas así. Los edificios rinden en ciclos, una y otra vez. En un mundo que se congeló, la repetición es su propia rebelión silenciosa.",
    ],
  },
  first_unique: {
    character: "lily", mood: "excited",
    title: ["Уникальный осколок", "A singular shard", "Un fragmento único"],
    body: [
      "Это не просто постройка — это целый закон старого мира, восстановленный. Её бонус работает везде, даже на доске. Таких семь. Каждый меняет то, как мир отвечает тебе.",
      "This is no ordinary building — it's an entire law of the old world, restored. Its bonus reaches everywhere, even the board. There are seven. Each changes how the world answers you.",
      "Esto no es un edificio común — es toda una ley del viejo mundo, restaurada. Su bono alcanza todo, incluso el tablero. Hay siete. Cada uno cambia cómo el mundo te responde.",
    ],
  },
  starter_full: {
    character: "root", mood: "wise",
    title: ["Земля кончилась", "The ground runs out", "Se acaba la tierra"],
    body: [
      "Четыре клочка заняты. Дальше — серость, и она не уступит даром. Расчистка стоит света; чем дальше от сердца Сада, тем дороже. Считай каждый шаг.",
      "Four patches taken. Beyond them, grey — and it won't yield for free. Clearing costs light; the farther from the Garden's heart, the steeper the price. Count every step.",
      "Cuatro parcelas ocupadas. Más allá, el gris — y no cederá gratis. Despejar cuesta luz; cuanto más lejos del corazón del Jardín, más alto el precio. Cuenta cada paso.",
    ],
  },
  first_rare: {
    character: "sage", mood: "mysterious",
    title: ["Что-то шевельнулось", "Something stirred", "Algo se movió"],
    body: [
      "Чувствуешь, как воздух стал плотнее? Это редкий артефакт — вопрос, на который Стазис так и не ответил. Каждое слияние L5+ может разбудить ещё один. Собери все четыре.",
      "Feel the air thicken? A rare artifact — a question the Stasis never answered. Every L5+ merge may wake another. Gather all four.",
      "¿Sientes el aire más denso? Un artefacto raro — una pregunta que el Estasis nunca respondió. Cada fusión L5+ puede despertar otro. Reúne los cuatro.",
    ],
  },
  built_greenhouse: {
    character: "root", mood: "playful",
    title: ["Теплица дышит", "The greenhouse breathes", "El invernadero respira"],
    body: [
      "Стекло запотело изнутри — значит, внутри что-то живо. Продажи L3+ предметов теперь идут вдвое дороже. Мир снова видит им цену.",
      "The glass has fogged from within — something inside is alive. L3+ items now sell for double. The world remembers their worth again.",
      "El cristal se ha empañado por dentro — algo vive ahí adentro. Los objetos L3+ ahora se venden al doble. El mundo recuerda su valor de nuevo.",
    ],
  },
  built_fairy_house: {
    character: "lily", mood: "excited",
    title: ["Я знала этот дом", "I knew this house", "Conocí esta casa"],
    body: [
      "Когда-то у меня было место, куда возвращаться. Теперь оно снова есть. Каждое слияние получает 10% шанс на бонусное комбо — маленькая милость в нелюбимом мире.",
      "I had a place to return to, once. Now it stands again. Every merge gains a 10% chance of a bonus combo — a small mercy in an unkind world.",
      "Tuve un lugar al que volver, una vez. Ahora se alza de nuevo. Cada fusión gana un 10% de probabilidad de combo extra — una pequeña merced en un mundo cruel.",
    ],
  },
  built_moon_obelisk: {
    character: "sage", mood: "mysterious",
    title: ["Серебро коснулось камня", "Silver touched the stone", "La plata tocó la piedra"],
    body: [
      "Обелиск помнит луну, которой больше нет на небе. Линия Луны открыта. Свет находит дорогу даже сквозь Стазис.",
      "The obelisk remembers a moon the sky no longer holds. The Moon line is open. Light finds its way, even through the Stasis.",
      "El obelisco recuerda una luna que el cielo ya no sostiene. La línea de la Luna está abierta. La luz halla su camino, incluso a través del Estasis.",
    ],
  },
  built_fire_tower: {
    character: "sage", mood: "mysterious",
    title: ["Башня горит", "The tower burns", "La torre arde"],
    body: [
      "Первое настоящее тепло за эпоху. Линия Флота разблокирована. Огонь не спрашивает у тишины разрешения.",
      "The first real warmth in an age. The Fleet line is unlocked. Fire asks the silence no permission.",
      "El primer calor real en una era. La línea de la Flota está desbloqueada. El fuego no le pide permiso al silencio.",
    ],
  },
  built_crystal_cave: {
    character: "sage", mood: "mysterious",
    title: ["Пещера ответила", "The cave answered", "La cueva respondió"],
    body: [
      "Глубина откликнулась эхом, которое ты не отправлял. Линия Кристалла теперь твоя. Иные вещи Стазис лишь спрятал, но не убил.",
      "The deep echoed back something you never sent down. The Crystal line is yours. Some things the Stasis only buried — it did not kill them.",
      "La profundidad devolvió un eco que nunca enviaste abajo. La línea del Cristal es tuya. Algunas cosas el Estasis solo las enterró — no las mató.",
    ],
  },
  built_tree_of_life: {
    character: "lily", mood: "excited",
    title: ["Древо вспомнило", "The Tree remembered", "El Árbol recordó"],
    body: [
      "Корни нашли то, что считалось потерянным. Энергия восстанавливается вдвое быстрее. Мир снова умеет начинать заново.",
      "The roots found what was thought lost. Energy regenerates twice as fast now. The world remembers how to begin again.",
      "Las raíces hallaron lo que se creía perdido. La energía se recupera el doble de rápido ahora. El mundo recuerda cómo volver a empezar.",
    ],
  },
  built_rainbow_bridge: {
    character: "sage", mood: "wise",
    title: ["Мост соединил разлом", "The bridge spans the rift", "El puente cruza la grieta"],
    body: [
      "Ты собрал все четыре артефакта — все четыре ответа. Мост стоит над разломом, который Стазис считал вечным. Отныне +30% света всюду.",
      "You gathered all four artifacts — all four answers. The bridge stands over a rift the Stasis called eternal. From now on, +30% light everywhere.",
      "Reuniste los cuatro artefactos — las cuatro respuestas. El puente se alza sobre una grieta que el Estasis llamaba eterna. Desde ahora, +30% de luz en todas partes.",
    ],
  },
  mastery_gift: {
    character: "sage", mood: "wise",
    title: ["Линия завершена", "A line completed", "Una línea completada"],
    body: [
      "Ты довёл линию до конца — до самой её сути. Mastery-бонус останется навсегда. Стазис не отбирает то, что понято до конца.",
      "You carried a line to its end — to its very meaning. The mastery bonus stays for good. The Stasis cannot take back what is fully understood.",
      "Llevaste una línea hasta su final — hasta su significado mismo. El bono de maestría se queda para siempre. El Estasis no puede recuperar lo que se entiende del todo.",
    ],
  },
  mastery_pizza: {
    character: "root", mood: "playful",
    title: ["Кузница не остыла", "The Forge held its heat", "La Forja conservó su calor"],
    body: [
      "Линия Кузницы покорена. +5 к пределу энергии. Старое ремесло всё ещё кормит.",
      "The Forge line is mastered. +5 to your energy ceiling. The old craft still provides.",
      "La línea de la Forja está dominada. +5 a tu límite de energía. El viejo oficio aún sustenta.",
    ],
  },
  mastery_rocket: {
    character: "sage", mood: "mysterious",
    title: ["Флот услышал звёзды", "The Fleet heard the stars", "La Flota oyó las estrellas"],
    body: [
      "Линия Флота покорена. −15% ко времени построек в Саду. То, что движется, обгоняет тишину.",
      "The Fleet line is mastered. −15% to garden build times. What moves outruns the silence.",
      "La línea de la Flota está dominada. −15% al tiempo de construcción del Jardín. Lo que se mueve le saca ventaja al silencio.",
    ],
  },
  mastery_unicorn: {
    character: "lily", mood: "excited",
    title: ["Феи собрались", "The Fae gathered", "Las Hadas se reunieron"],
    body: [
      "Линия Фей покорена. Светящееся существо дарит +1 Призыв в день. Они не забыли, как быть щедрыми.",
      "The Fae line is mastered. The glimmer-creature gifts +1 Beckon a day. They have not forgotten how to be generous.",
      "La línea de las Hadas está dominada. La criatura de destellos regala +1 Llamada al día. No han olvidado cómo ser generosas.",
    ],
  },
  mastery_gem: {
    character: "sage", mood: "wise",
    title: ["Кристалл отдал свет", "The Crystal gave its light", "El Cristal entregó su luz"],
    body: [
      "Линия Кристалла покорена. +15% к свету садовых построек. Давление веков — теперь твоя награда.",
      "The Crystal line is mastered. +15% to garden building yields. The pressure of ages is your reward now.",
      "La línea del Cristal está dominada. +15% al rendimiento de los edificios del Jardín. La presión de las eras ahora es tu recompensa.",
    ],
  },
  mastery_guitar: {
    character: "lily", mood: "playful",
    title: ["Симфония зазвучала", "The Symphony sounds", "La Sinfonía suena"],
    body: [
      "Линия Симфонии покорена. Музыка рождает +1 пыльцу в день. Мир снова держит мелодию.",
      "The Symphony line is mastered. The music brings +1 pixie dust a day. The world holds a tune again.",
      "La línea de la Sinfonía está dominada. La música trae +1 polvo de hada al día. El mundo vuelve a llevar una melodía.",
    ],
  },
  mastery_dolphin: {
    character: "root", mood: "wise",
    title: ["Океан признал тебя", "The Ocean knows you", "El Océano te conoce"],
    body: [
      "Линия Океана покорена. Капля ускоряет восстановление энергии в ×1.2. Зеркало мира снова видит того, кто смотрит.",
      "The Ocean line is mastered. The droplet speeds energy regen ×1.2. The world's mirror sees its watcher again.",
      "La línea del Océano está dominada. La gota acelera la recuperación de energía ×1.2. El espejo del mundo vuelve a ver a quien lo observa.",
    ],
  },
  mastery_trophy: {
    character: "root", mood: "excited",
    title: ["Созвездие названо", "A constellation named", "Una constelación nombrada"],
    body: [
      "Линия Звёзд покорена. +25% к силе комбо. Память мира снова горит ярко.",
      "The Stellar line is mastered. +25% combo power. The world's memory burns bright again.",
      "La línea de las Estrellas está dominada. +25% al poder de combo. La memoria del mundo vuelve a arder con fuerza.",
    ],
  },
  mastery_phone: {
    character: "sage", mood: "wise",
    title: ["Последний ответ", "The last answer", "La última respuesta"],
    body: [
      "Линия Артефактов покорена — последняя из всех. ×2 к спавну сюрпризов. Ты собрал очертание того, что придёт после Стазиса.",
      "The Artifacts line is mastered — the last of them all. ×2 surprise spawn. You've traced the shape of what comes after the Stasis.",
      "La línea de los Artefactos está dominada — la última de todas. ×2 a la aparición de sorpresas. Has trazado la forma de lo que viene tras el Estasis.",
    ],
  },
  streak_3: {
    character: "lily", mood: "playful",
    title: ["Три дня", "Three days", "Tres días"],
    body: [
      "Три дня подряд ты возвращаешься в серость по своей воле. Стазис этого не понимает. Мне нравится, что он не понимает.",
      "Three days you've returned to the grey by choice. The Stasis cannot grasp that. I like that it cannot.",
      "Tres días seguidos vuelves al gris por tu propia voluntad. El Estasis no lo comprende. Me gusta que no lo comprenda.",
    ],
  },
  streak_7: {
    character: "lily", mood: "excited",
    title: ["Неделя", "A week", "Una semana"],
    body: [
      "Семь дней. Ты больше не гость в этом мире — ты его часть. Сад это чувствует.",
      "Seven days. You're no longer a visitor here — you're part of this world. The Garden feels it.",
      "Siete días. Ya no eres un visitante aquí — eres parte de este mundo. El Jardín lo siente.",
    ],
  },
  streak_14: {
    character: "sage", mood: "wise",
    title: ["Две недели", "Two weeks", "Dos semanas"],
    body: [
      "Четырнадцать дней. Это уже не случайность и не любопытство. Это решение, повторённое достаточно раз, чтобы стать путём.",
      "Fourteen days. This is no longer chance or curiosity. It's a choice repeated often enough to become a path.",
      "Catorce días. Ya no es azar ni curiosidad. Es una elección repetida las veces suficientes para volverse un camino.",
    ],
  },
  streak_30: {
    character: "sage", mood: "mysterious",
    title: ["Тридцать дней", "Thirty days", "Treinta días"],
    body: [
      "Тридцать дней. Мир, что разучился меняться, изменился — потому что ты приходил. Сад выбрал тебя своим хранителем.",
      "Thirty days. A world that forgot how to change has changed — because you kept coming. The Garden has chosen you as its keeper.",
      "Treinta días. Un mundo que olvidó cómo cambiar ha cambiado — porque seguiste viniendo. El Jardín te ha elegido como su guardián.",
    ],
  },
  first_prestige: {
    character: "sage", mood: "mysterious",
    title: ["Круг замкнулся", "The circle closed", "El círculo se cerró"],
    body: [
      "Ты прошёл весь путь и начал его заново — по своей воле. Звёздная пыль остаётся. Немногие в застывшем мире умеют отпускать, чтобы обрести больше.",
      "You walked the whole path, then began it again — by choice. The stardust remains. Few in a frozen world know how to let go in order to hold more.",
      "Recorriste todo el camino y lo empezaste de nuevo — por tu voluntad. El polvo estelar permanece. Pocos en un mundo congelado saben soltar para poder sostener más.",
    ],
  },
  first_weekly_claim: {
    character: "lily", mood: "excited",
    title: ["Первая награда", "The first reward", "La primera recompensa"],
    body: [
      "Мир что-то отдал тебе сам, без слияния, без труда. Это редко. Запомни этот момент — Стазис нечасто бывает щедр.",
      "The world gave you something on its own — no merge, no labour. That's rare. Remember it. The Stasis is seldom generous.",
      "El mundo te dio algo por sí mismo — sin fusión, sin esfuerzo. Eso es raro. Recuérdalo. El Estasis rara vez es generoso.",
    ],
  },
};

// --- Seen-episode tracking + active panel ---

const STORAGE_KEY = "magicmerge.story.seen";

function loadSeen(): Set<StoryEvent> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as StoryEvent[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function persistSeen(set: Set<StoryEvent>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore quota errors */
  }
}

export const seenEpisodes = writable<Set<StoryEvent>>(loadSeen());
seenEpisodes.subscribe(persistSeen);

export const activeEpisode = writable<StoryEvent | null>(null);

/**
 * Trigger an episode. No-op if already seen. The renderer (StoryPanel)
 * pops up over the game, blocks input until dismissed, then clears.
 */
export function trigger(event: StoryEvent): void {
  const seen = get(seenEpisodes);
  if (seen.has(event)) return;
  if (!STORY[event]) return;
  seenEpisodes.update((s) => {
    const next = new Set(s);
    next.add(event);
    return next;
  });
  activeEpisode.set(event);
}

export function dismissEpisode(): void {
  activeEpisode.set(null);
}

/**
 * Re-open an episode the player has already seen — used by the Story Log.
 * Unlike trigger(), this is idempotent and does NOT touch seenEpisodes,
 * so the log can show the panel without changing progression state.
 */
export function replayEpisode(event: StoryEvent): void {
  if (!STORY[event]) return;
  activeEpisode.set(event);
}

/** Render a localized field at the current locale. */
export function localizeTitle(line: StoryLine, loc?: Locale): string {
  const l = loc ?? get(locale);
  return tt(l, line.title[0], line.title[1], line.title[2]);
}

export function localizeBody(line: StoryLine, loc?: Locale): string {
  const l = loc ?? get(locale);
  return tt(l, line.body[0], line.body[1], line.body[2]);
}

export function localizeName(c: StoryCharacter, loc?: Locale): string {
  const l = loc ?? get(locale);
  const t = characterName(c);
  return tt(l, t[0], t[1], t[2]);
}

/** Reset all episodes to unseen — useful for the Reset button. */
export function clearSeenEpisodes(): void {
  seenEpisodes.set(new Set());
}
