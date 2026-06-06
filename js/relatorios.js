// js/relatorios.js — Geração de PDF

async function gerarRelatorioMensalPDF(mes) {
  const { jsPDF } = window.jspdf;
  const pagamentos = await buscarDadosRelatorio(mes);

  if (!pagamentos.length) {
    mostrarToast('Nenhum pagamento neste período', 'aviso');
    return;
  }

  const doc = new jsPDF();
  const mesFormatado = new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Cabeçalho
  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(0, 255, 135);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('GestorFit', 20, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(`Relatório Financeiro — ${mesFormatado}`, 20, 32);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 20, 55);

  const total = pagamentos.reduce((s, p) => s + parseFloat(p.valor), 0);
  doc.setFillColor(240, 255, 245);
  doc.rect(15, 62, 180, 16, 'F');
  doc.setTextColor(0, 150, 80);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Recebido: ${formatarMoeda(total)}`, 20, 73);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`${pagamentos.length} pagamento(s)`, 150, 73);

  let y = 90;
  doc.setFillColor(30, 30, 50);
  doc.rect(15, y - 6, 180, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Aluno', 20, y);
  doc.text('Data', 90, y);
  doc.text('Forma', 120, y);
  doc.text('Valor', 160, y);
  doc.text('Código', 175, y);
  y += 8;

  pagamentos.forEach((p, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(15, y - 5, 180, 9, 'F'); }
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text((p.alunos?.nome || '--').substring(0, 30), 20, y);
    doc.text(formatarData(p.data_pagamento), 90, y);
    doc.text(p.forma_pagamento, 120, y);
    doc.text(formatarMoeda(p.valor), 155, y, { align: 'right' });
    doc.text(p.codigo_verificacao || '--', 170, y);
    y += 9;
  });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Verifique autenticidade em: gestorfit.com.br/verificar', 105, 285, { align: 'center' });

  doc.save(`GestorFit-Relatorio-${mes}.pdf`);
  mostrarToast('📄 Relatório gerado!');
}

function gerarReciboPDF(pagamento, aluno) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ format: 'a5' });

  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, 148, 30, 'F');

  doc.setTextColor(0, 255, 135);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('GestorFit', 10, 14);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('RECIBO DE PAGAMENTO', 10, 24);

  doc.setFillColor(0, 200, 107);
  doc.rect(90, 8, 50, 16, 'F');
  doc.setTextColor(10, 10, 15);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CÓDIGO DE VERIFICAÇÃO', 115, 14, { align: 'center' });
  doc.setFontSize(9);
  doc.text(pagamento.codigo_verificacao || '--', 115, 21, { align: 'center' });

  doc.setTextColor(30, 30, 30);
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

  let y = 42;
  dados.forEach(([label, valor]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 10, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(valor || '--'), 55, y);
    y += 10;
  });

  doc.setDrawColor(200, 200, 200);
  doc.line(10, y + 2, 138, y + 2);
  y += 10;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Verificar em: gestorfit.com.br/verificar', 10, y);
  doc.setTextColor(0, 100, 200);
  doc.text(pagamento.codigo_verificacao || '', 10, y + 6);
  doc.setTextColor(100, 100, 100);
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 10, y + 14);

  doc.save(`Recibo-${aluno.nome}-${pagamento.referencia_mes}.pdf`);
}
