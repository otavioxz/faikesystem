const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { TIPOS, SEPARADORES, buildNomes } = require("../utils/nomes");
const owner = process.env.OWNER;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nomes")
    .setDescription("Gera ideias de nomes de usuário raros. (Apenas Dono)")
    .addStringOption((opt) =>
      opt
        .setName("tipo")
        .setDescription("Tipo de nome (padrão: 4 letras pronunciáveis)")
        .addChoices(
          ...Object.entries(TIPOS).map(([value, t]) => ({ name: t.label, value }))
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName("quantidade")
        .setDescription("Quantos nomes gerar (padrão: 15)")
        .setMinValue(5)
        .setMaxValue(25)
    )
    .addStringOption((opt) =>
      opt
        .setName("separacao")
        .setDescription("Como juntar as palavras das frases (padrão: juntas)")
        .addChoices(
          ...Object.entries(SEPARADORES).map(([value, s]) => ({
            name: `${s.label} (${s.exemplo})`,
            value,
          }))
        )
    ),
  async execute(interaction) {
    if (interaction.user.id !== owner) {
      return interaction.reply({
        content: "Este comando só pode ser usado pelo dono do bot.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const tipo = interaction.options.getString("tipo") ?? "cvcv";
    const quantidade = interaction.options.getInteger("quantidade") ?? 15;
    const sep = interaction.options.getString("separacao") ?? "nenhum";

    await interaction.reply({
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      components: [buildNomes(tipo, quantidade, sep)],
    });
  },
};
