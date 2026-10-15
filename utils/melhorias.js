const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  FileBuilder,
  MediaGalleryBuilder,
  RoleSelectMenuBuilder,
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
  melhoria: { label: "Melhoria", emoji: "<:melhoria:1559752147128688670>", desc: "Ideia nova ou aprimoramento de algo existente" },
  duvida: { label: "Dúvida", emoji: "<:duvida:1559752148634312714>", desc: "Como funciona algum comando ou sistema" },
  correcao: { label: "Correção", emoji: "<:correcao:1559752144993910894>", desc: "Algo que não está funcionando como deveria" },
  outros: { label: "Outros", emoji: "<:outros:1559752149800329257>", desc: "Qualquer outro assunto" },
};

const PRIORIDADES = {
  baixa: { label: "Baixa", emoji: "<:low:1559753164742201444>", desc: "Pode esperar" },
  media: { label: "Média", emoji: "<:medium:1559753166235504750>", desc: "Faria diferença no dia a dia" },
  alta: { label: "Alta", emoji: "<:high:1559753167527350345>", desc: "Impacta bastante o servidor" },
};

const STATUS = {
  pendente: { label: "Pendente", emoji: "<a:loading:1560437917552480367>" },
  analise: { label: "Em análise", emoji: "<:lupa:1560430223160377380>" },
  aprovada: { label: "Aprovada", emoji: "<:aprovado:1560428240013758647>" },
  recusada: { label: "Recusada", emoji: "<:recusado:1560428244937744484>" },
  concluida: { label: "Concluída", emoji: "<a:foguete:1560428241917841499>" },
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

function getGuildConfig(db, guildId) {
  db.guilds[guildId] ??= {};
  db.guilds[guildId].roles ??= [];
  db.guilds[guildId].fallbackChannelId ??= null;
  return db.guilds[guildId];
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
    .map((c) => `${c.emoji} **${c.label}**\n-# ${c.desc}`)
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
        "### Como funciona\n- Escolha a categoria\n- Defina a prioridade\n- Preencha o formulário\n-# Você acompanha o status pela DM"
      )
    )
    .addSeparatorComponents(separator(true))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("melhoria_abrir")
          .setLabel("Enviar solicitação")
          .setEmoji("<a:setinha:1560437915568578610>")
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
          .setEmoji("<a:preencher:1560437919422873730>")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("melhoria_reiniciar")
          .setLabel("Recomeçar")
          .setEmoji("<:refazer:1560428247383015444>")
          .setStyle(ButtonStyle.Secondary)
      )
    );
}

function buildConfirmacao(req) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        `## Solicitação enviada\nProtocolo **${formatId(req.id)}** — **${req.titulo}**${req.anexos?.length || req.anexosLinks?.length ? `\nAnexos enviados: **${(req.anexos?.length || 0) + (req.anexosLinks?.length || 0)}**` : ""}\nVocê receberá uma DM sempre que o status mudar.`
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
    .addTextDisplayComponents(text(body));

  // Anexos reenviados junto da mensagem (referenciados por attachment://)
  const anexos = req.anexos || [];
  const links = req.anexosLinks || [];
  if (anexos.length || links.length) {
    container
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(
        text(`### Anexos (${anexos.length + links.length})`)
      );
    const midias = anexos.filter((a) => a.midia);
    if (midias.length) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          midias.map((a) => (item) =>
            item.setURL(`attachment://${a.nome}`).setDescription(a.original)
          )
        )
      );
    }
    for (const a of anexos.filter((a) => !a.midia)) {
      container.addFileComponents(
        new FileBuilder().setURL(`attachment://${a.nome}`)
      );
    }
    if (links.length) {
      container.addTextDisplayComponents(
        text(
          links.map((l) => `[${l.nome}](${l.url})`).join("\n") +
            "\n-# Grandes demais para reenviar; links temporários do Discord"
        )
      );
    }
  }

  container
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
          (req.resposta ? `\n**Mensagem enviada:** ${req.resposta}` : "") +
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
// mencionar: usado no canal de fallback quando a DM do solicitante está fechada
function buildNotificacao(req, { mencionar = false } = {}) {
  const s = STATUS[req.status];
  const container = new ContainerBuilder().addTextDisplayComponents(
    text(
      `-# ATUALIZAÇÃO DE SOLICITAÇÃO\n## ${s.emoji} ${s.label}\n${mencionar ? `<@${req.userId}>, sua` : "Sua"} solicitação **${formatId(req.id)} — ${req.titulo}**, enviada em **${req.guildName}**, teve o status atualizado.`
    )
  );
  if (req.resposta) {
    container
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(
        text(`### Mensagem da equipe\n${req.resposta}`)
      );
  }
  return container
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text("-# Central de Solicitações"));
}

// Painel de configuração por servidor (apenas ADMIN_ID)
function buildConfig(guild) {
  const cfg = getGuildConfig(readDb(), guild.id);
  const canal = cfg.fallbackChannelId
    ? `<#${cfg.fallbackChannelId}>`
    : "`Não definido`";
  const cargos = cfg.roles.length
    ? cfg.roles.map((r) => `<@&${r}>`).join(" ")
    : "`Nenhum` (apenas quem tem Gerenciar Servidor)";

  const fallbackSelect = new ChannelSelectMenuBuilder()
    .setCustomId("melhoria_cfg_fallback")
    .setPlaceholder("Canal de fallback (DM fechada)")
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(0)
    .setMaxValues(1);
  if (cfg.fallbackChannelId) {
    fallbackSelect.setDefaultChannels(cfg.fallbackChannelId);
  }

  const rolesSelect = new RoleSelectMenuBuilder()
    .setCustomId("melhoria_cfg_roles")
    .setPlaceholder("Cargos que podem enviar solicitações")
    .setMinValues(0)
    .setMaxValues(25);
  if (cfg.roles.length) rolesSelect.setDefaultRoles(...cfg.roles);

  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        `-# CONFIGURAÇÃO\n## Central de Solicitações\nServidor: **${guild.name}**`
      )
    )
    .addSeparatorComponents(separator(true))
    .addTextDisplayComponents(
      text(
        `### Canal de fallback\nSe a DM do solicitante estiver fechada, a atualização de status é enviada aqui marcando ele.\nAtual: ${canal}`
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(fallbackSelect)
    )
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(
      text(
        `### Cargos permitidos\nAlém de quem tem **Gerenciar Servidor**, esses cargos podem enviar solicitações.\nAtuais: ${cargos}`
      )
    )
    .addActionRowComponents(new ActionRowBuilder().addComponents(rolesSelect))
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(
      text("-# Desmarque tudo no seletor para limpar a configuração")
    );
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
  getGuildConfig,
  podeSolicitar,
  buildConfig,
  buildPainel,
  buildEtapaCategoria,
  buildEtapaPrioridade,
  buildEtapaFormulario,
  buildConfirmacao,
  buildHub,
  buildNotificacao,
};
