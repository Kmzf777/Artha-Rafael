# Artha System

Painel operacional de atendimento e vendas por WhatsApp da **Artha** — planejamento e educação financeira: conversas, leads, disparos de template, agendamentos, reativação da base inativa e relatórios.

## Language

**Segmento**:
A qual dos três produtos do cliente o lead pertence: `artha` (B2C, pessoa física, Open Finance), `dhana` (B2B, white-label para planejadores financeiros) ou `lucia` (IA operacional para escritórios). Todo lead tem exatamente um.
_Avoid_: produto, vertical, linha

**Etapa** (funil):
Posição do lead no funil comercial: novo → contatado → qualificado → convertido, ou perdido. Muda por ação do operador, não automaticamente.
_Avoid_: status (que é do plano), fase, estágio

**Status de plano**:
Situação da assinatura do lead: ativo, cancelado, trial expirado ou inadimplente. É independente da Etapa — um lead convertido pode estar inadimplente.
_Avoid_: etapa, situação

**Inativo**:
Lead sem acesso ao produto há mais tempo que a régua aplicada. Não é sinônimo de plano cancelado: um assinante ativo que parou de entrar também é inativo. É a população-alvo da Reativação.
_Avoid_: churn, cancelado, perdido

**Régua**:
O conjunto de filtros que define o recorte da Reativação — dias sem acesso, status de plano e produto. A mesma régua tem de devolver o mesmo número em qualquer tela.
_Avoid_: filtro, critério, segmentação

**Recorte**:
O conjunto de leads que a Régua seleciona num dado momento. É o que vai para a fila de disparos.
_Avoid_: seleção, lista, público

**Disparo**:
Envio de um template aprovado para um Recorte. Vira uma Campanha quando executado e popula Agendamentos.
_Avoid_: campanha (que é o registro do disparo já feito), blast, envio em massa

**Janela de 24h**:
Prazo em que a conversa aceita mensagem livre depois da última mensagem recebida do contato. Fora dela, só template aprovado.
_Avoid_: prazo, sessão, timeout

**Estado de entrega**:
Situação de uma mensagem enviada: enviado, entregue, lido ou falhou. Sempre exibido como ícone **mais** rótulo em cinza — nunca por cor.
_Avoid_: status de mensagem, delivery
