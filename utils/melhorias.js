const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const dbPath = path.join(__dirname, "../database/melhorias.json");

const CATEGORIAS = {
  melhoria: { label: "Melhoria", emoji: "✨", desc: "Ideia nova ou aprimoramento de algo existente" },
  duvida: { label: "Dúvida", emoji: "❔", desc: "Como funciona algum comando ou sistema" },
  correcao: { label: "Correção", emoji: "🛠️", desc: "Algo que não está funcionando como deveria" },
  outros: { label: "Outros", emoji: "📁", desc: "Qualquer outro assunto" },
};

const PRIORIDADES = {
  baixa: { label: "Baixa", emoji: "⚪", desc: "Pode esperar" },
  media: { label: "Média", emoji: "🔘", desc: "Faria diferença no dia a dia" },
  alta: { label: "Alta", emoji: "⚫", desc: "Impacta bastante o servidor" },
};

const STATUS = {
  pendente: { label: "Pendente", emoji: "⏳" },
  analise: { label: "Em análise", emoji: "🔍" },
  aprovada: { label: "Aprovada", emoji: "✅" },
  recusada: { label: "Recusada", emoji: "❌" },
  concluida: { label: "Concluída", emoji: "🚀" },
};

// Único usuário que pode configurar o painel e alterar status no hub
const ADMIN_ID = "976215691059429417";

const COOLDOWN_MS = 5 * 60 * 1000;
const cooldowns = new Map();

function readDb() {
  if (!fs.existsSync(dbPath)) {
    return { counter: 0, guilds: {}, requests: {} };
  }
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function formatId(id) {
  return `#${String(id).padStart(4, "0")}`;
}

function podeSolicitar(member, guildId) {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const roles = readDb().guilds[guildId]?.roles || [];
  return member.roles.cache.some((r) => roles.includes(r.id));
}

function text(content) {
  return new TextDisplayBuilder().setContent(content);
}

function separator(large = false) {
  return new SeparatorBuilder().setSpacing(
    large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small
  );
}

// Painel público enviado no servidor
function buildPainel(guild) {
  const categorias = Object.values(CATEGORIAS)
    .map((c) => `${c.emoji} **${c.label}** — ${c.desc}`)
    .join("\n");

  const header = new SectionBuilder()
    .addTextDisplayComponents(
      text(
        `# Central de Solicitações\nTem uma ideia, dúvida ou encontrou um problema no bot do **${guild.name}**? Envie direto para a equipe de desenvolvimento.`
      )
    )
    .setThumbnailAccessory(
      new ThumbnailBuilder().setURL(
        guild.iconURL({ size: 256 }) || guild.client.user.displayAvatarURL()
      )
    );

  return new ContainerBuilder()
    .addSectionComponents(header)
    .addSeparatorComponents(separator(true))
    .addTextDisplayComponents(text(`### Categorias\n${categorias}`))
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(
      text(
        "### Como funciona\n`1` Escolha a categoria\n`2` Defina a prioridade\n`3` Preencha o formulário\n-# Você acompanha o status pela DM"
      )
    )
    .addSeparatorComponents(separator(true))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("melhoria_abrir")
          .setLabel("Enviar solicitação")
          .setEmoji("📨")
          .setStyle(ButtonStyle.Secondary)
      )
    )
    .addTextDisplayComponents(
      text("-# Disponível para administradores e cargos responsáveis")
    );
}

function stepHeader(step, titulo, info) {
  return text(
    `-# ETAPA ${step} DE 3\n## ${titulo}${info ? `\n${info}` : ""}`
  );
}

function selectRow(customId, placeholder, entries) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(
        entries.map(([value, o]) => ({
          label: o.label,
          value,
          emoji: o.emoji,
          description: o.desc,
        }))
      )
  );
}

function resumo({ cat, prio }) {
  const linhas = [];
  if (cat) linhas.push(`Categoria: ${CATEGORIAS[cat].emoji} **${CATEGORIAS[cat].label}**`);
  if (prio) linhas.push(`Prioridade: ${PRIORIDADES[prio].emoji} **${PRIORIDADES[prio].label}**`);
  return linhas.join("\n");
}

function buildEtapaCategoria() {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      stepHeader(1, "Categoria", "Sobre o que é a sua solicitação?")
    )
    .addSeparatorComponents(separator())
    .addActionRowComponents(
      selectRow("melhoria_cat", "Selecione a categoria", Object.entries(CATEGORIAS))
    );
}

function buildEtapaPrioridade(cat) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      stepHeader(
        2,
        "Prioridade",
        `${resumo({ cat })}\nQual a urgência da sua solicitação?`
      )
    )
    .addSeparatorComponents(separator())
    .addActionRowComponents(
      selectRow(
        `melhoria_prio:${cat}`,
        "Selecione a prioridade",
        Object.entries(PRIORIDADES)
      )
    );
}

function buildEtapaFormulario(cat, prio) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      stepHeader(3, "Formulário", resumo({ cat, prio }))
    )
    .addSeparatorComponents(separator())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`melhoria_form:${cat}:${prio}`)
          .setLabel("Preencher formulário")
          .setEmoji("📝")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("melhoria_reiniciar")
          .setLabel("Recomeçar")
          .setEmoji("↩️")
          .setStyle(ButtonStyle.Secondary)
      )
    );
}

function buildConfirmacao(req) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        `## Solicitação enviada\nProtocolo **${formatId(req.id)}** — **${req.titulo}**\nVocê receberá uma DM sempre que o status mudar.`
      )
    )
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text("-# Obrigado por ajudar a melhorar o bot"));
}

// Mensagem no servidor hub
function buildHub(req) {
  const s = STATUS[req.status];
  const c = CATEGORIAS[req.categoria];
  const p = PRIORIDADES[req.prioridade];

  let body = `### Descrição\n${req.descricao}`;
  if (req.detalhes) body += `\n### Informações adicionais\n${req.detalhes}`;

  const header = new SectionBuilder()
    .addTextDisplayComponents(
      text(
        `-# SOLICITAÇÃO ${formatId(req.id)}\n## ${req.titulo}\n${c.emoji} **${c.label}**  ·  ${p.emoji} Prioridade **${p.label}**`
      )
    )
    .setThumbnailAccessory(
      new ThumbnailBuilder().setURL(req.guildIcon || req.userAvatar)
    );

  // Containers sem accent color (sem a barra lateral colorida)
  const container = new ContainerBuilder()
    .addSectionComponents(header)
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(
      text(
        `**Servidor:** ${req.guildName} (\`${req.guildId}\`)\n**Solicitante:** <@${req.userId}> (\`${req.userTag}\`)\n**Enviada:** <t:${Math.floor(req.createdAt / 1000)}:R>`
      )
    )
    .addSeparatorComponents(separator(true))
    .addTextDisplayComponents(
      text(
        `**Status:** ${s.emoji} ${s.label}` +
          (req.updatedBy
            ? `\n-# Atualizado por <@${req.updatedBy}> <t:${Math.floor(req.updatedAt / 1000)}:R>`
            : "")
      )
    );

  const finalizada = ["recusada", "concluida"].includes(req.status);
  const botoes = ["analise", "aprovada", "recusada", "concluida"].map((key) =>
    new ButtonBuilder()
      .setCustomId(`melhoria_status:${req.id}:${key}`)
      .setLabel(STATUS[key].label)
      .setEmoji(STATUS[key].emoji)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(req.status === key || finalizada)
  );
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(botoes)
  );
  return container;
}

// DM pro solicitante quando o status muda
function buildNotificacao(req) {
  const s = STATUS[req.status];
  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        `-# ATUALIZAÇÃO DE SOLICITAÇÃO\n## ${s.emoji} ${s.label}\nSua solicitação **${formatId(req.id)} — ${req.titulo}**, enviada em **${req.guildName}**, teve o status atualizado.`
      )
    )
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text("-# Central de Solicitações"));
}

module.exports = {
  ADMIN_ID,
  CATEGORIAS,
  PRIORIDADES,
  STATUS,
  COOLDOWN_MS,
  cooldowns,
  readDb,
  writeDb,
  formatId,
  podeSolicitar,
  buildPainel,
  buildEtapaCategoria,
  buildEtapaPrioridade,
  buildEtapaFormulario,
  buildConfirmacao,
  buildHub,
  buildNotificacao,
};
