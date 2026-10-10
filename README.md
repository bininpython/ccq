# CCQ · Monitoramento de rolos do forno RB1

Aplicação completa em português com React, TypeScript e Vite, API Python e banco SQLite centralizado. Posições 0 a 4 conforme o mapa de referência; posição 0 externa ao forno. Nenhum dado operacional fictício é inserido.

## Recursos

- Mapa interativo do forno e cartões de condição por posição.
- Cor calculada automaticamente: **0–5 dias verde**, **6–10 amarelo**, **11+ vermelho**. Sem data registrada: cinza.
- Registro de troca: posição/local, identificação instalada e retirada, diâmetro opcional, motivo, data, horário, operador e observações.
- Turno derivado da hora em Brasília: TN 23h–07h, TM 07h–15h, TT 15h–23h.
- Histórico permanente, pesquisa por operador/motivo/identificação/turno, filtro por posição e exportação CSV compatível com Excel.
- Checklist de superfície, ruído, vibração, alinhamento e mancais/refrigeração. Anomalia exige observação e abre uma atividade no kanban.
- Kanban A fazer → Em andamento → Concluído, com movimentação por seletor acessível e trilha de alterações.
- Banco compartilhado no servidor, sessões de 12 horas e atualização a cada 30 segundos. Registros concorrentes de troca são verificados por versão.
- Interface responsiva para computador, tablet e celular.

## Iniciar com Docker

1. Copie `.env.example` para `.env` e preencha `CCQ_ACCESS_PASSWORD` (mínimo 12 caracteres).
2. Execute `docker compose up -d --build`.
3. Abra `http://localhost:8000`. Informe nome completo e a senha configurada.

Para outros computadores na mesma rede, use `http://IP-DO-SERVIDOR:8000` (com liberação da porta pela TI). Todos devem acessar **o mesmo servidor**, para compartilhar os registros. O volume `ccq-data` preserva o banco entre reinicializações. Não use `docker compose down -v`, pois remove o volume.

## Executar sem Docker

Requisitos: Node.js 22+ e Python 3.12+ com base de fusos IANA (Linux a inclui; no Windows, instale `tzdata` com pip).

```bash
npm ci
npm run build
# Configure CCQ_ACCESS_PASSWORD no ambiente antes de iniciar.
python server/app.py
```

Em PowerShell: `$env:CCQ_ACCESS_PASSWORD="sua-senha-forte"`. Em bash: `export CCQ_ACCESS_PASSWORD='sua-senha-forte'`. Nunca coloque a senha no código nem faça commit do `.env`.

Desenvolvimento: inicie a API e execute `npm run dev` em outro terminal. O Vite encaminha `/api` para a porta 8000. Produção serve a compilação e a API pelo mesmo endereço.

## Hospedagem e acesso

Execute o contêiner em um servidor com disco persistente (rede interna, VPS ou serviço de contêiner). Este projeto **não funciona como site estático na Vercel**: precisa da API e do volume SQLite. Para acesso externo, use HTTPS com proxy reverso, defina `CCQ_SECURE_COOKIE=1` e limite acesso pela rede da empresa/VPN. A hospedagem não está provisionada neste repositório.

O acesso inicial usa senha compartilhada e identificação declarada pelo operador. Não constitui autenticação individual de identidade nem assinatura eletrônica. Todos os usuários autenticados podem registrar atividades e mover cartões; não há exclusão ou edição de trocas pela interface. Caso a política da empresa exija usuários individuais/SSO e perfis de permissão, integrar antes da adoção oficial.

## Regras e limitações operacionais

- Contagem em **dias de calendário em America/Sao_Paulo**; à meia-noite começa o próximo dia. Não são blocos de 24 horas.
- O relógio do servidor é a referência. Datas futuras e trocas anteriores à última instalação são rejeitadas.
- Na primeira utilização, registre a data real da última instalação de cada posição com motivo “Primeiro cadastro / instalação”. Os registros seguintes formam o histórico.
- Cores representam tempo desde a troca, não medição física nem autorização de operação. O checklist registra observação humana, sem conexão com sensores/CLP.
- Uma troca não conclui automaticamente atividades de manutenção: elas devem ser avaliadas e encerradas pelo operador.
- Cada checklist com anomalia gera uma atividade; inspeções repetidas podem criar novas atividades relacionadas.
- CSV exporta todo o histórico de trocas, independentemente dos filtros da tela.
- Faça backup consistente de `data/ccq.sqlite3` usando a API SQLite de backup (ou pare o serviço antes de copiar o banco e arquivos WAL). O arquivo contém histórico e sessões: proteja seu acesso. Teste a restauração periodicamente.

## Verificação

```bash
npm test
npm run build
```

Os testes cobrem limites de cor, virada de dia/fuso, turnos, início sem dados, histórico, conflitos de troca/kanban, datas futuras e checklist com anomalias.

## Estrutura

- `src/main.tsx`: interface e fluxos operacionais.
- `src/style.css`: sistema visual responsivo.
- `server/app.py`: API, sessões, validação, persistência e servidor estático.
- `tests/test_app.py`: testes das regras de negócio.
- `Dockerfile` / `compose.yaml`: execução com volume persistente.

Não existe integração automática com equipamentos: a automação é a contagem de dias, classificação, turno, atualização do painel e criação de atividades a partir do checklist.
