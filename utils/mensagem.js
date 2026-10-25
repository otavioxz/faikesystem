const {
  ContainerBuilder,
  FileBuilder,
  MediaGalleryBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} = require("discord.js");

// Linha contendo só "---" no texto vira um separador
const MARCADOR_SEPARADOR = /^\s*-{3,}\s*$/m;

function text(content) {
  return new TextDisplayBuilder().setContent(content);
}

function separator(large = false) {
  return new SeparatorBuilder().setSpacing(
    large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small
  );
}

// Monta o container da mensagem enviada pelo /enviar-mensagem
// anexos: [{ nome, original, midia }] já anexados na mensagem (attachment://)
function buildMensagem({ titulo, conteudo, rodape, anexos = [], posicao = "abaixo", separadores = true }) {
  const container = new ContainerBuilder();
  // Cada seção é uma função que adiciona componentes ao container
  const secoes = [];

  const midias = anexos.filter((a) => a.midia);
  const arquivos = anexos.filter((a) => !a.midia);
  const galeria = midias.length
    ? (c) =>
        c.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            midias.map((a) => (item) =>
              item.setURL(`attachment://${a.nome}`).setDescription(a.original)
            )
          )
        )
    : null;

  if (titulo) secoes.push((c) => c.addTextDisplayComponents(text(`## ${titulo}`)));
  if (galeria && posicao === "acima") secoes.push(galeria);

  const blocos = conteudo
    .split(MARCADOR_SEPARADOR)
    .map((b) => b.trim())
    .filter(Boolean);
  secoes.push((c) =>
    blocos.forEach((bloco, i) => {
      // Separador manual (---) sempre aparece, mesmo com separadores desligados
      if (i > 0) c.addSeparatorComponents(separator());
      c.addTextDisplayComponents(text(bloco));
    })
  );

  if (galeria && posicao !== "acima") secoes.push(galeria);
  if (arquivos.length) {
    secoes.push((c) => {
      for (const a of arquivos) {
        c.addFileComponents(new FileBuilder().setURL(`attachment://${a.nome}`));
      }
    });
  }
  if (rodape) secoes.push((c) => c.addTextDisplayComponents(text(`-# ${rodape}`)));

  secoes.forEach((secao, i) => {
    if (i > 0 && separadores) container.addSeparatorComponents(separator(true));
    secao(container);
  });
  return container;
}

module.exports = { buildMensagem };
