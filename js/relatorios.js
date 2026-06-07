// js/relatorios.js — Geração de PDF

// Cores do design system
const PDF_COLORS = {
  bg:      [10, 10, 15],
  accent:  [108, 99, 255],
  success: [0, 212, 170],
  danger:  [255, 71, 87],
  white:   [241, 241, 246],
  gray:    [139, 139, 167],
  rowEven: [22, 22, 30],
};

function _pdfHeader(doc, titulo, subtitulo) {
  doc.setFillColor(...PDF_COLORS.bg);
  doc.rect(0, 0, 210, 42, 'F');

  // Accent bar on left
  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(0, 0, 4, 42, 'F');

  doc.setTextColor(...PDF_COLORS.accent);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('GestorFit', 14, 18);

  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(titulo, 14, 30);

  if (subtitulo) {
    doc.setTextColor(...PDF_COLORS.gray);
    doc.setFontSize(9);
    doc.text(subtitulo, 14, 38);
  }
}

async function gerarRelatorioMensalPDF(mes) {
  const { jsPDF } = window.jspdf;
  const pagamentos = await buscarDadosRelatorio(mes);

  if (!pagamentos.length) {
    mostrarToast('Nenhum pagamento neste período', 'aviso');
    return;
  }

  const doc = new jsPDF();
  const mesFormatado = new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  _pdfHeader(doc, `Relatório Financeiro — ${mesFormatado}`, `Emitido em: ${new Date().toLocaleString('pt-BR')}`);

  const total = pagamentos.reduce((s, p) => s + parseFloat(p.valor), 0);

  // Summary box
  doc.setFillColor(108, 99, 255, 0.12);
  doc.setFillColor(18, 18, 28);
  doc.rect(14, 50, 182, 14, 'F');
  doc.setDrawColor(...PDF_COLORS.accent);
  doc.setLineWidth(0.5);
  doc.rect(14, 50, 182, 14, 'D');
  doc.setTextColor(...PDF_COLORS.success);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Recebido: ${formatarMoeda(total)}`, 20, 59);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.setFontSize(9);
  doc.text(`${pagamentos.length} pagamento(s)`, 160, 59);

  // Table header
  let y = 78;
  doc.setFillColor(...PDF_COLORS.bg);
  doc.rect(14, y - 6, 182, 10, 'F');
  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(14, y + 3.5, 182, 0.4, 'F');
  doc.setTextColor(...PDF_COLORS.accent);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ALUNO', 20, y);
  doc.text('DATA', 90, y);
  doc.text('FORMA', 120, y);
  doc.text('VALOR', 170, y, { align: 'right' });
  doc.text('CÓDIGO', 175, y);
  y += 8;

  pagamentos.forEach((p, i) => {
    if (y > 272) { doc.addPage(); y = 20; }
    if (i % 2 === 0) {
      doc.setFillColor(...PDF_COLORS.rowEven);
      doc.rect(14, y - 5, 182, 9, 'F');
    }
    doc.setTextColor(...PDF_COLORS.white);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text((p.alunos?.nome || '--').substring(0, 30), 20, y);
    doc.text(formatarData(p.data_pagamento), 90, y);
    doc.text(p.forma_pagamento || '--', 120, y);
    doc.setTextColor(...PDF_COLORS.success);
    doc.text(formatarMoeda(p.valor), 170, y, { align: 'right' });
    doc.setTextColor(...PDF_COLORS.gray);
    doc.setFontSize(8);
    doc.text(p.codigo_verificacao || '--', 175, y);
    doc.setFontSize(9);
    y += 9;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text('Verifique autenticidade em: gestorfit.com.br/verificar', 105, 285, { align: 'center' });

  doc.save(`GestorFit-Relatorio-${mes}.pdf`);
  mostrarToast('PDF gerado com sucesso!', 'sucesso');
}

function gerarReciboPDF(pagamento, aluno) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ format: 'a5' });

  // Header
  doc.setFillColor(...PDF_COLORS.bg);
  doc.rect(0, 0, 148, 34, 'F');
  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(0, 0, 3, 34, 'F');

  doc.setTextColor(...PDF_COLORS.accent);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('GestorFit', 10, 14);
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('RECIBO DE PAGAMENTO', 10, 24);

  // Verification code box
  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(94, 6, 46, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CÓD. VERIFICAÇÃO', 117, 14, { align: 'center' });
  doc.setFontSize(10);
  doc.text(pagamento.codigo_verificacao || '--', 117, 23, { align: 'center' });

  // Fields
  doc.setTextColor(40, 40, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const dados = [
    ['Aluno:', aluno.nome],
    ['CPF:', aluno.cpf || 'Não informado'],
    ['Plano:', aluno.planos_academia?.nome || '--'],
    ['Valor pago:', formatarMoeda(pagamento.valor)],
    ['Data:', formatarData(pagamento.data_pagamento)],
    ['Forma:', (pagamento.forma_pagamento || '').toUpperCase()],
    ['Referência:', pagamento.referencia_mes],
    ['Próx. vencimento:', formatarData(aluno.data_vencimento)],
  ];

  let y = 46;
  dados.forEach(([label, valor]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 100);
    doc.text(label, 10, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 40);
    doc.text(String(valor || '--'), 52, y);
    y += 10;
  });

  doc.setDrawColor(200, 200, 210);
  doc.line(10, y + 2, 138, y + 2);
  y += 10;

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 140);
  doc.text('Verificar em: gestorfit.com.br/verificar', 10, y);
  doc.setTextColor(...PDF_COLORS.accent.map(v => Math.min(v + 40, 255)));
  doc.text(pagamento.codigo_verificacao || '', 10, y + 7);
  doc.setTextColor(120, 120, 140);
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 10, y + 15);

  doc.save(`Recibo-${aluno.nome}-${pagamento.referencia_mes}.pdf`);
}
