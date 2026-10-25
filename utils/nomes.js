const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} = require("discord.js");

const LETRAS = "abcdefghijklmnopqrstuvwxyz";
const NUMEROS = "0123456789";
const CONSOANTES = "bcdfghjklmnprstvxz";
const VOGAIS = "aeiou";

// Sem acentos e sem ç: o Discord só aceita a-z, 0-9, _ e .
const VERBOS = [
  "ser", "ter", "ver", "dar", "ler", "rir", "vir", "por", "amar", "sair",
  "cair", "voar", "orar", "usar", "ruir", "arder", "olhar", "sonhar", "viver", "correr",
  "fugir", "sorrir", "chorar", "cantar", "dancar", "brilhar", "queimar", "sentir", "partir", "lutar",
  "vencer", "perder", "ganhar", "nadar", "pular", "jogar", "beber", "comer", "dormir", "acordar",
  "pensar", "falar", "calar", "gritar", "sumir", "voltar", "ficar", "andar", "mudar", "cuidar",
  "criar", "quebrar", "girar", "tocar", "odiar", "mentir", "sofrer", "curar", "salvar", "pintar",
  "reinar", "florir", "nascer", "crescer", "esquecer", "lembrar", "esperar", "buscar", "achar", "fluir",
  "flutuar", "chover", "ventar", "uivar", "rugir", "morder", "tentar", "sangrar", "existir", "resistir",
];

// Formas conjugadas curtas (1ª pessoa do presente), costumam ser mais raras
const VERBOS_CONJUGADOS = [
  "amo", "sinto", "fujo", "minto", "corro", "sonho", "vivo", "choro", "canto", "danço",
  "brilho", "queimo", "luto", "venço", "perco", "ganho", "nado", "pulo", "jogo", "bebo",
  "durmo", "penso", "falo", "calo", "grito", "sumo", "volto", "fico", "ando", "mudo",
  "crio", "quebro", "giro", "toco", "odeio", "sofro", "curo", "salvo", "pinto", "reino",
  "nasco", "cresço", "esqueço", "lembro", "espero", "busco", "acho", "fluo", "flutuo", "existo",
].map((v) => v.replace(/ç/g, "c"));

const FRASES_PT = [
  ["sem", "fim"], ["tanto", "faz"], ["sei", "la"], ["nunca", "mais"], ["nada", "mais"],
  ["tudo", "passa"], ["vida", "boa"], ["fica", "aqui"], ["volta", "logo"], ["meu", "ceu"],
  ["ceu", "azul"], ["luz", "da", "lua"], ["tudo", "ou", "nada"], ["deixa", "rolar"], ["so", "hoje"],
  ["sempre", "mais"], ["sonhei", "alto"], ["sem", "medo"], ["sem", "rumo"], ["mar", "aberto"],
  ["alma", "livre"], ["fogo", "frio"], ["noite", "fria"], ["por", "do", "sol"], ["eu", "sei"],
  ["nem", "ligo"], ["so", "vai"], ["vai", "dar", "certo"], ["sem", "pressa"], ["dia", "cinza"],
  ["meu", "mundo"], ["outro", "lado"], ["ate", "logo"], ["fim", "de", "tarde"], ["sol", "nascente"],
  ["mente", "vazia"], ["coracao", "frio"], ["lua", "nova"], ["sem", "volta"], ["quase", "nada"],
];

const FRASES_EN = [
  ["no", "way"], ["stay", "gold"], ["lost", "soul"], ["not", "today"], ["dont", "care"],
  ["be", "free"], ["so", "what"], ["just", "vibes"], ["sleep", "less"], ["far", "away"],
  ["no", "regrets"], ["dream", "big"], ["stay", "wild"], ["over", "it"], ["why", "not"],
  ["let", "go"], ["new", "moon"], ["cold", "heart"], ["save", "me"], ["run", "away"],
  ["all", "in"], ["slow", "down"], ["see", "you"], ["ghost", "mode"], ["night", "owl"],
  ["true", "love"], ["hold", "on"], ["no", "sleep"], ["burn", "out"], ["stay", "low"],
  ["dark", "side"], ["lone", "wolf"], ["good", "vibes"], ["only", "you"], ["never", "again"],
  ["after", "dark"], ["half", "moon"], ["wild", "heart"], ["silent", "night"], ["end", "game"],
];

const TIPOS = {
  cvcv: { label: "4 letras pronunciáveis", desc: "Consoante + vogal, ex.: bako, rumi" },
  letras: { label: "4 letras", desc: "Só letras aleatórias, ex.: qxzv" },
  misto: { label: "4 caracteres mistos", desc: "Letras, números, _ e ., ex.: k_9x" },
  verbos: { label: "Verbos em português", desc: "Infinitivo e conjugados, ex.: sonhar, fujo" },
  frasespt: { label: "Frases em português", desc: "Frases curtas, ex.: semfim, tantofaz" },
  frasesen: { label: "Frases em inglês", desc: "Frases curtas, ex.: staygold, notoday" },
};

const SEPARADORES = {
  nenhum: { label: "Juntas", exemplo: "semfim", char: "" },
  underline: { label: "Com _", exemplo: "sem_fim", char: "_" },
  ponto: { label: "Com .", exemplo: "sem.fim", char: "." },
};

const sortear = (str) => str[Math.floor(Math.random() * str.length)];

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Regras atuais de username do Discord
function usernameValido(nome) {
  return /^[a-z0-9_.]{2,32}$/.test(nome) && !nome.includes("..");
}

function gerarQuatro(tipo) {
  if (tipo === "cvcv") {
    return sortear(CONSOANTES) + sortear(VOGAIS) + sortear(CONSOANTES) + sortear(VOGAIS);
  }
  if (tipo === "letras") {
    return Array.from({ length: 4 }, () => sortear(LETRAS)).join("");
  }
  // Misto: começa e termina com letra/número, _ e . só no meio
  const borda = LETRAS + NUMEROS;
  const meio = borda + "_.";
  return sortear(borda) + sortear(meio) + sortear(meio) + sortear(borda);
}

function gerarNomes(tipo, quantidade, sep = "nenhum") {
  const char = SEPARADORES[sep]?.char ?? "";
  let candidatos;

  if (tipo === "verbos") {
    candidatos = embaralhar([...VERBOS, ...VERBOS_CONJUGADOS]);
  } else if (tipo === "frasespt" || tipo === "frasesen") {
    const frases = tipo === "frasespt" ? FRASES_PT : FRASES_EN;
    candidatos = embaralhar(frases.map((p) => p.join(char)));
  } else {
    const nomes = new Set();
    // Limite de tentativas para não travar se a quantidade for alta
    for (let i = 0; nomes.size < quantidade && i < quantidade * 20; i++) {
      nomes.add(gerarQuatro(tipo));
    }
    candidatos = [...nomes];
  }

  return [...new Set(candidatos)].filter(usernameValido).slice(0, quantidade);
}

function text(content) {
  return new TextDisplayBuilder().setContent(content);
}

function separator(large = false) {
  return new SeparatorBuilder().setSpacing(
    large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small
  );
}

function buildNomes(tipo, quantidade, sep) {
  const nomes = gerarNomes(tipo, quantidade, sep);
  const ehFrase = tipo === "frasespt" || tipo === "frasesen";
  const estado = `${tipo}:${quantidade}:${sep}`;

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        `-# GERADOR DE NOMES\n## ${TIPOS[tipo].label}\n-# ${nomes.length} nome(s)${ehFrase ? ` · ${SEPARADORES[sep].label}` : ""} · confira a disponibilidade em Configurações › Minha conta`
      )
    )
    .addSeparatorComponents(separator(true))
    .addTextDisplayComponents(
      text(nomes.map((n) => `\`${n}\``).join("  ·  ") || "Nenhum nome gerado.")
    )
    .addSeparatorComponents(separator(true))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`nomes_tipo:${quantidade}:${sep}`)
          .setPlaceholder("Tipo de nome")
          .addOptions(
            Object.entries(TIPOS).map(([value, t]) => ({
              label: t.label,
              value,
              description: t.desc,
              default: value === tipo,
            }))
          )
      )
    );

  if (ehFrase) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`nomes_sep:${tipo}:${quantidade}`)
          .setPlaceholder("Separação das palavras")
          .addOptions(
            Object.entries(SEPARADORES).map(([value, s]) => ({
              label: s.label,
              value,
              description: `Ex.: ${s.exemplo}`,
              default: value === sep,
            }))
          )
      )
    );
  }

  return container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`nomes_gerar:${estado}`)
        .setLabel("Gerar outros")
        .setEmoji("<:refazer:1560428247383015444>")
        .setStyle(ButtonStyle.Secondary)
    )
  );
}

module.exports = { TIPOS, SEPARADORES, gerarNomes, buildNomes };
