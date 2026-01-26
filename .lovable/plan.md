
Objetivo: implementar (1) módulo de entregador com acesso apenas aos pedidos “para entrega” e ação “marcar como entregue”, (2) corrigir a data “Desde 2016” para “Desde 2015”, (3) corrigir o bug do “Estamos abertos” no cliente, (4) adicionar impressão por Bluetooth (ESC/POS) para 58mm (somente no login/área de funcionário e admin), (5) melhorar seleção de sabores separando por categorias e garantindo preço correto ao misturar categorias, e (6) aplicar ajustes básicos de performance/bugs sem reestruturar o sistema.

--------------------------------------------------------------------
1) Correção do “Estamos Abertos” no cliente (bug de loja fechada)
--------------------------------------------------------------------
Problema atual (confirmado no código):
- `HomePage.tsx` mostra o badge usando apenas `settings.isOpen` (flag manual), ignorando o horário real calculado em `useStoreAvailability`.
- Resultado: pode aparecer “Estamos Abertos” mesmo fora do horário.

Mudança proposta:
- Em `src/pages/HomePage.tsx`, trocar a lógica do badge para usar:
  - `const { availability } = useStoreAvailability(settings.isOpen);`
  - Exibir “Estamos abertos” somente se `availability.isOpenNow === true`.
  - Se estiver fechado: mostrar “Fechado no momento” e, se existir, “abre {dia} às {hora}” (mesma ideia do Header).
- Manter `settings.isOpen` como “chave manual” (se o admin desligar, fica fechado sempre), mas o status público sempre refletirá o horário real.

Arquivos:
- `src/pages/HomePage.tsx`
- (opcional) centralizar um helper `formatNextOpen` já usado no Header para reaproveitar.

--------------------------------------------------------------------
2) Consertar a data de início: “2016” -> “2015”
--------------------------------------------------------------------
Mudança pedida:
- Apenas texto no site do cliente.

Mudança proposta:
- Em `src/pages/HomePage.tsx`, trocar a frase:
  - de: “Desde 2016 …”
  - para: “Desde 2015 …”

Arquivos:
- `src/pages/HomePage.tsx`

--------------------------------------------------------------------
3) Módulo do Entregador (novo “papel/role” + novas telas)
--------------------------------------------------------------------
Requisitos confirmados nas suas respostas:
- Entregador vê apenas pedidos “para entrega”
- Entregador pode “Marcar como entregue”
- Precisa ver detalhes: endereço e itens
- No Admin: precisa existir gestão de entregadores como já existe “Funcionários”.

3.1) Banco de dados / permissões
Hoje:
- Roles são `admin`, `user`, `staff` no enum `app_role`.
- Atualização de pedidos (`orders UPDATE`) está restrita ao admin via RLS.
- Para entregador marcar como entregue, precisamos permitir update controlado.

Mudanças no schema (migração):
- Adicionar `entregador` ao enum `public.app_role`.
- Adicionar policy RLS específica em `orders`:
  - permitir UPDATE somente para usuários com role `entregador`
  - restringir para: atualizar APENAS `status` para `DELIVERED`
  - e opcionalmente: somente se status atual do pedido estiver `READY` (ou seja, “pronto para sair”)
  
Observação importante:
- Isso mantém segurança: o entregador não consegue editar endereço/cliente/itens, só “entregar”.

3.2) Edge function de gestão de usuários (reaproveitar, sem quebrar o fluxo atual)
Hoje:
- `manage-staff-user` cria usuário e sempre atribui role “staff”.
- O AdminStaff também liga/desliga role “staff” direto na tabela `user_roles`.

Mudança proposta (compatível):
- Atualizar `manage-staff-user` para aceitar um parâmetro opcional `role` no body (ex: `"staff"` por padrão; ou `"entregador"`).
- Continuar funcionando sem mudar nada do fluxo atual (se não enviar role, continua criando staff).

3.3) Admin: tela “Entregadores”
Mudança proposta:
- Criar uma página `AdminDeliverers` (cópia adaptada de `AdminStaff.tsx`):
  - listagem de perfis
  - toggle de acesso “Entregador”
  - criar / editar / excluir usuário via mesma edge function (passando `role: 'entregador'` no create)
- Adicionar item no menu do AdminLayout e rota em `App.tsx`:
  - `/admin/entregadores`

Arquivos (novos/alterados):
- `src/pages/admin/AdminDeliverers.tsx` (novo, baseado em AdminStaff)
- `src/pages/admin/AdminLayout.tsx` (adicionar item de menu)
- `src/App.tsx` (nova rota)
- `supabase/functions/manage-staff-user/index.ts` (aceitar role)
- Nova migration para enum + RLS

3.4) Área do Entregador (login + lista de pedidos + detalhe + marcar entregue)
Estratégia para não misturar com “Funcionário”:
- Criar um contexto novo `DeliveryContext` (igual ao StaffContext) que:
  - faz login via email/senha
  - valida role `entregador` via RPC `has_role`
  - mantém `isAuthenticated` apenas se user + role ok
- Criar layout `DeliveryLayout` (similar ao StaffLayout) com navegação mínima.
- Criar páginas:
  - `DeliveryLoginPage` (similar ao StaffLoginPage)
  - `DeliveryOrdersPage`:
    - lista apenas pedidos “para entrega” = status `READY` (e possivelmente também `CONFIRMED/PREPARING` se você quiser no futuro; por enquanto ficará `READY`)
    - ao clicar em um pedido, abre detalhe (Dialog) mostrando endereço e itens
    - botão “Marcar como entregue” -> chama `supabase.from('orders').update({ status: 'DELIVERED' }).eq('id', order.id)`
      - RLS garantirá que só role entregador e só transição permitida
- Rotas sugeridas:
  - `/entregador` (login)
  - `/entregador/pedidos`

Arquivos:
- `src/contexts/DeliveryContext.tsx` (novo)
- `src/pages/delivery/DeliveryLayout.tsx` (novo)
- `src/pages/delivery/DeliveryLoginPage.tsx` (novo)
- `src/pages/delivery/DeliveryOrdersPage.tsx` (novo)
- `src/App.tsx` (rotas novas)

--------------------------------------------------------------------
4) Impressão Bluetooth 58mm (Web Bluetooth + ESC/POS) apenas no Admin e Funcionário
--------------------------------------------------------------------
Problema atual:
- impressão é via `window.open + window.print()`, que pode falhar/ficar travada em alguns ambientes e não resolve “imprimir por bluetooth” direto.
- você quer Bluetooth tanto notebook quanto celular.
- restrição: apenas em áreas logadas (admin/funcionário).

Abordagem escolhida: Web Bluetooth (ESC/POS)
- Implementar impressão via `navigator.bluetooth.requestDevice` + `gatt.connect` + escrita em characteristic (geralmente serviço 0xFFE0/0xFFE1 ou similar; varia por impressora).
- Criar um fluxo:
  1) botão “Conectar impressora Bluetooth”
  2) depois “Imprimir via Bluetooth (58mm)” em pedidos/admin e checkout/staff
- Criar um “gerador de cupom ESC/POS” (texto monoespaçado) e enviar bytes.

Limitações que o plano vai respeitar:
- iPhone/iOS Safari não suporta Web Bluetooth; no iPhone isso provavelmente só funcionará em apps/ambientes específicos. Em Android + Chrome funciona bem.
- No notebook: Chrome/Edge geralmente funciona; depende da impressora suportar BLE/GATT e expor serviço gravável.

Implementação técnica (sem dependências novas):
- Criar util `src/lib/escpos.ts`:
  - `connectBluetoothPrinter()` -> retorna um objeto com `write(bytes)`
  - `buildEscPosReceipt(order, width)` -> monta texto e comandos:
    - initialize (ESC @)
    - alinhamentos, negrito simples quando possível
    - corte (GS V) se suportado
  - `encode(text)` com `TextEncoder`
- Padronizar largura:
  - 58mm: ~32 colunas
  - 80mm: ~48 colunas (opcional manter)
  - Como você pediu 58mm, o foco será 58mm.
- Integrar nos pontos:
  - Staff: `src/pages/staff/StaffCheckoutPage.tsx` (substituir/acompanhar o botão de imprimir atual com opção Bluetooth)
  - Staff: `src/pages/staff/StaffOrdersPage.tsx` (reimpressão via Bluetooth)
  - Admin: `src/pages/admin/AdminOrders.tsx` (imprimir pedido via Bluetooth)

Regras de acesso (somente logado):
- Botões de Bluetooth só aparecem dentro de rotas protegidas (Admin/Staff), então já atende.

Arquivos:
- `src/lib/escpos.ts` (novo)
- `src/pages/staff/StaffCheckoutPage.tsx`
- `src/pages/staff/StaffOrdersPage.tsx`
- `src/pages/admin/AdminOrders.tsx`

--------------------------------------------------------------------
5) Seleção de sabores da pizza por categorias + preço correto ao misturar categorias
--------------------------------------------------------------------
Situação atual:
- O cardápio já separa as pizzas por categoria (MenuPage).
- Porém no modal de montar pizza (`PizzaCard.tsx`), a seleção do 2º sabor aparece em lista única, sem separação.
- O preço da pizza usa “maior preço” entre sabores selecionados (o que é uma boa regra).
- As categorias podem ter preço fixo por tamanho (vindo do banco via StoreContext), então misturar “Tradicional” com “Especial” deve resultar no valor de “Especial” (maior) — mas a UX não deixa claro e a seleção não está organizada.

Mudanças propostas no `PizzaCard.tsx`:
1) Separar o seletor de sabores em blocos por categoria:
   - Tradicionais / Especiais / Doces (na prática: usar `pizzaCategories` do StoreContext/consulta e o `categoryId` de cada sabor)
2) No modo 2 sabores:
   - ao escolher o segundo sabor, mostrar em qual categoria ele está
   - se a categoria do 2º sabor for diferente do 1º, mostrar aviso pequeno:
     - “Ao misturar categorias, o preço considera o maior valor entre os sabores.”
3) Garantir cálculo:
   - manter `Math.max(...prices[size])`, que já resolve a maioria dos casos.
   - revisar se “Doces” (categoria com `price_*` nulo) está corretamente usando preço do sabor; se estiver tudo 33/45/50/60 no sabor, ok.
4) (Opcional) travar “mistura de doce com salgado” se você quiser regra de negócio; como você não pediu travar, apenas ajustar preço corretamente, então não vou bloquear.

Arquivos:
- `src/components/public/PizzaCard.tsx`
- (possível) pequenos helpers para agrupar sabores por categoria com fallback “Outras”.

--------------------------------------------------------------------
6) Melhorar velocidade e corrigir bugs (sem reescrever tudo)
--------------------------------------------------------------------
Ações de impacto rápido e baixo risco:
1) Reduzir carga de pedidos em telas não-admin:
   - Hoje `useOrders()` busca `select('*')` de todos os pedidos e ainda assina realtime.
   - Para Staff e Entregador (e até Admin com filtro), isso pode ficar pesado.
   - Proposta:
     - Ajustar `useOrders` para aceitar opções (ex: `mode: 'admin' | 'staff' | 'delivery'`, `daysBack`, `statuses`)
     - Ou criar hooks específicos:
       - `useOrdersAdmin()`: continua amplo
       - `useOrdersToday()`/`useOrdersByStatus()`: busca só o necessário
   - Para entregador: buscar somente status `READY` nos últimos X dias/horas.

2) Remover logs em excesso:
   - `useOrders` faz `console.log('Order change received')` para todo evento realtime. Isso pode degradar e poluir console.
   - Trocar por logs condicionais (dev only) ou remover.

3) Consultas mais enxutas:
   - em `useOrders` trocar `select('*')` por colunas usadas (id, customer_*, items, status, total, created_at, etc.), evitando payload maior.

4) Garantir consistência do “aberto/fechado”:
   - além do HomePage, revisar quaisquer outros locais que usem `settings.isOpen` direto para mostrar status ao cliente.

Arquivos:
- `src/hooks/useOrders.ts`
- possivelmente `src/pages/admin/AdminOrders.tsx`, `src/pages/staff/StaffOrdersPage.tsx`, `DeliveryOrdersPage.tsx` (novo)

--------------------------------------------------------------------
Ordem de execução recomendada (para evitar retrabalho)
--------------------------------------------------------------------
Fase A (correções rápidas visíveis)
1) HomePage: “Estamos abertos” usando `useStoreAvailability`
2) HomePage: “Desde 2016” -> “Desde 2015”
3) PizzaCard: separar seleção por categorias e aviso de preço ao misturar

Fase B (Entregador)
4) Migração: adicionar role `entregador` + RLS de update controlado em orders
5) Atualizar edge function `manage-staff-user` para aceitar `role` (mantendo default staff)
6) Admin: criar tela “Entregadores” e adicionar no menu/rotas
7) Criar área do entregador (context/layout/login/pedidos/detalhe/marcar entregue)

Fase C (Bluetooth 58mm)
8) Criar util ESC/POS + Web Bluetooth (conectar/imprimir)
9) Integrar no StaffCheckout + StaffOrders + AdminOrders (somente logados)
10) Manter fallback com `window.print()` como opção secundária (caso bluetooth não seja compatível no dispositivo)

Fase D (Performance)
11) Ajustar `useOrders` e reduzir payload/logs
12) Garantir que entregador/staff não carreguem pedidos desnecessários

--------------------------------------------------------------------
Checklist de aceite (o que você vai conseguir testar)
--------------------------------------------------------------------
- Página inicial do cliente:
  - mostra “Fechado” quando está fora do horário, mesmo que `Status da Pizzaria` esteja ligado
  - mostra “Desde 2015”
- Modal de pizza:
  - sabores separados por categoria
  - misturar categorias atualiza preço corretamente (maior valor) e avisa
- Admin:
  - existe menu “Entregadores”
  - admin cria entregador e ativa/desativa acesso
- Entregador:
  - login próprio
  - lista apenas pedidos prontos (READY)
  - abre detalhe com endereço e itens
  - marca como entregue (DELIVERED)
- Impressão Bluetooth:
  - no Staff/Admin aparece botão “Conectar impressora” e “Imprimir via Bluetooth (58mm)”
  - imprime cupom sem precisar abrir nova janela de impressão (quando o dispositivo suportar Web Bluetooth)

--------------------------------------------------------------------
Notas técnicas importantes (para transparência)
--------------------------------------------------------------------
- Web Bluetooth (ESC/POS) depende do navegador/dispositivo; em geral funciona melhor em Android/Chrome e notebooks Chrome/Edge. iPhone tende a não suportar.
- A política RLS para entregador será bem restritiva (somente mudar status para DELIVERED) para evitar qualquer risco de alteração de dados sensíveis.
- Não vou expor login/registro na área pública (mantém a separação Public vs Admin/Staff/Entregador).

Se você aprovar este plano, eu implemento em etapas (A → B → C → D) para você já ver resultados rapidamente e reduzir risco de regressões.
