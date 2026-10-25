const { Events, MessageFlags, AttachmentBuilder } = require("discord.js");
const { buildMensagem } = require("../../utils/mensagem");
const owner = process.env.OWNER;

// Limite de upload de bot sem boost
const LIMITE_UPLOAD = 10 * 1024 * 1024;

// Baixa as imagens do forms (URLs temporárias) para anexar na mensagem final
async function baixarImagens(uploads) {
  const files = [];
  const anexos = [];
  const falhas = [];
  let total = 0;

  for (const [i, att] of [...uploads.values()].entries()) {
    const nome = `${i + 1}-${att.name.replace(/[^\w.-]/g, "_")}`;
    const midia = /^(image|video)\//.test(att.contentType || "");

    if (total + att.size > LIMITE_UPLOAD) {
      falhas.push(`${att.name} (passa do limite de 10 MB)`);
      continue;
    }
    try {
      const res = await fetch(att.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      files.push(
        new AttachmentBuilder(Buffer.from(await res.arrayBuffer()), { name: nome })
      );
      anexos.push({ nome, original: att.name, midia });
      total += att.size;
    } catch {
      falhas.push(`${att.name} (falha no download)`);
    }
  }
  return { files, anexos, falhas };
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isModalSubmit() || !interaction.customId.startsWith("enviarmsg_modal:")) return;

    if (interaction.user.id !== owner) {
      return interaction.reply({
        content: "Este comando só pode ser usado pelo dono do bot.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const [, channelId, separadores, mencoes] = interaction.customId.split(":");
    const conteudo = interaction.fields.getTextInputValue("conteudo").trim();
    if (!conteudo.replace(/^\s*-{3,}\s*$/gm, "").trim()) {
      return interaction.reply({
        content: "A mensagem não pode ter apenas separadores.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      return interaction.reply({
        content: `Não consegui acessar o canal <#${channelId}>.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const uploads = interaction.fields.getUploadedFiles("imagens");
    const { files, anexos, falhas } = uploads?.size
      ? await baixarImagens(uploads)
      : { files: [], anexos: [], falhas: [] };

    const container = buildMensagem({
      titulo: interaction.fields.getTextInputValue("titulo").trim(),
      conteudo,
      rodape: interaction.fields.getTextInputValue("rodape").trim(),
      anexos,
      posicao: interaction.fields.getStringSelectValues("posicao")?.[0] ?? "abaixo",
      separadores: separadores === "1",
    });

    let msg;
    try {
      msg = await channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [container],
        files,
        allowedMentions:
          mencoes === "1" ? { parse: ["users", "roles", "everyone"] } : { parse: [] },
      });
    } catch (error) {
      console.error(`[MENSAGEM] Falha ao enviar mensagem em #${channel.name}:`.red.bold, error);
      return interaction.editReply({
        content: `Não consegui enviar a mensagem em ${channel}: \`${error.message}\``,
      });
    }

    console.log(
      `[MENSAGEM] Mensagem enviada por ${interaction.user.tag} em #${channel.name} (${channel.guild?.name})`
        .cyan.bold
    );

    await interaction.editReply({
      content:
        `Mensagem enviada em ${channel}: ${msg.url}` +
        (falhas.length ? `\nArquivos não enviados: ${falhas.join(", ")}` : ""),
    });
  },
};
