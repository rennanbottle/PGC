// Bancos de questões importados: formatos aceitos, conferência do arquivo e mensagens de erro.
// O banco e o bucket "bancos" repetem os limites (migração 0006).
import { TAMANHO_MAXIMO, tituloDoArquivo } from './materiais.js'

export const FORMATOS_BANCO = {
  pdf: { rotulo: 'PDF', mime: 'application/pdf', extensao: 'pdf' },
  docx: { rotulo: 'DOCX', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensao: 'docx' },
  txt: { rotulo: 'TXT', mime: 'text/plain', extensao: 'txt' },
  csv: { rotulo: 'CSV', mime: 'text/csv', extensao: 'csv' },
  xlsx: { rotulo: 'XLSX', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensao: 'xlsx' },
}

export const ERROS_BANCO = {
  nenhuma_questao: 'Não achamos questões numeradas no arquivo. Confira se cada uma começa com "1.", "2." ou "Questão 1".',
  colunas_faltando: 'A planilha precisa de uma coluna "enunciado". As alternativas podem vir nas colunas A, B, C, D e E, e a resposta na coluna "gabarito".',
  xlsx_invalido: 'Não deu para abrir esta planilha. Salve de novo como .xlsx ou como CSV e envie.',
  pdf_escaneado: 'PDF escaneado: são fotos de página, sem texto para ler. Passe por um leitor de texto (OCR), como o do Google Drive, e envie o resultado.',
  pdf_protegido: 'O PDF tem senha. Salve uma cópia sem senha e envie de novo.',
  pdf_invalido: 'Não deu para abrir este PDF. Ele pode estar corrompido.',
  docx_invalido: 'Não deu para abrir este DOCX. Salve de novo no Word ou no Google Docs e envie.',
  paginas_demais: 'O arquivo passa de 300 páginas. Divida em partes menores.',
  texto_grande: 'O texto passa de 400 mil caracteres. Divida em partes menores.',
  texto_vazio: 'Não há texto para ler neste arquivo.',
  arquivo_nao_encontrado: 'O arquivo não chegou ao servidor. Envie de novo.',
  limite: 'Você chegou ao limite de 5000 questões. Arquive ou exclua algumas e importe de novo.',
  falha_leitura: 'Algo deu errado ao ler o arquivo. Tente de novo em instantes.',
}
export const mensagemErroBanco = (codigo) => ERROS_BANCO[codigo] ?? ERROS_BANCO.falha_leitura

export function conferirArquivoBanco(arquivo) {
  const nome = String(arquivo?.name ?? '')
  const extensao = nome.includes('.') ? nome.split('.').pop().toLowerCase() : ''
  if (extensao === 'xls') return { erro: `${nome}: o formato .xls antigo não é aceito. Salve como .xlsx ou CSV.` }
  if (extensao === 'doc') return { erro: `${nome}: o formato .doc antigo não é aceito. Salve como .docx.` }
  const formato = Object.keys(FORMATOS_BANCO).find((f) => FORMATOS_BANCO[f].extensao === extensao)
  if (!formato) return { erro: `${nome || 'Este arquivo'}: só PDF, DOCX, TXT, CSV ou XLSX.` }
  if (!arquivo.size) return { erro: `${nome}: o arquivo está vazio.` }
  if (arquivo.size > TAMANHO_MAXIMO) return { erro: `${nome}: passa de 10 MB.` }
  return { formato, titulo: tituloDoArquivo(nome) }
}
