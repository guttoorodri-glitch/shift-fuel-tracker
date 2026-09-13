# Estoque e vendas + PDF do recebimento

## Alterações
- Renomear “Resumo do dia” para “Estoque e vendas” na aba Turnos.
- Gerar um PDF para cada recebimento salvo, com data, distribuidora, NF, combustíveis, quantidades e resultados das análises.
- Adicionar ao histórico de Recebimento os botões “WhatsApp” e “Salvar PDF”, compartilhando o PDF como anexo quando o aparelho permitir.
- Manter uma alternativa que salva o PDF para anexar manualmente quando o navegador não aceitar compartilhamento de arquivos.

## Detalhes técnicos
- Criar um gerador de PDF dedicado ao recebimento usando a biblioteca já instalada.
- Preparar o arquivo antes do toque para preservar o compartilhamento nativo no Android.
- Corrigir a diferença de data entre servidor e aparelho que atualmente provoca erro de carregamento em Relatórios.
- Conferir o fluxo no tamanho de tela do celular e inspecionar visualmente o PDF gerado.
