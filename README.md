# RB1 Roll · Condição dos rolos — Aperam RB1

Painel em React + TypeScript, **sem login e sem senha**, com identidade visual roxa `#490B42` e laranja `#F1511B`. O painel abre diretamente. O nome do operador é obrigatório em cada registro e nas movimentações do kanban.

## Recursos

- Diagrama do forno em SVG: carcaça, revestimento refratário, queimadores e chamas animadas; a tira passa por cima dos rolos 0 a 4. Clique em um rolo para abrir os detalhes.
- Cartões por posição com barra de campanha (limites de 6 e 11 dias).

- Mapa das posições 0 a 4 conforme a referência: rolo 0 externo e 1–4 no forno.
- Cores automáticas: **0–5 dias verde**, **6–10 amarelo**, **11+ vermelho**. Sem data: cinza. Contagem por dias de calendário em Brasília.
- Trocas com data, hora, turno automático (TN 23–07, TM 07–15, TT 15–23), posição, motivo, identificação anterior/nova, diâmetro e observações.
- Histórico de trocas pesquisável e exportável em CSV para Excel.
- Checklist com anomalias que geram atividades no kanban.
- Kanban com etapas, identificação de quem moveu e histórico das movimentações.
- Atualização do painel a cada 30 segundos, proteção contra versões conflitantes e validação de datas futuras.

## Hospedagem estática (Vercel, por exemplo)

```bash
npm ci
npm run build
```

Configure o projeto como **Vite**, comando `npm run build` e saída `dist`. A página abre sem autenticação.

Quando não existe `/api/state` (404/405 ou página HTML em vez de JSON), o painel usa armazenamento local do navegador. O aviso no topo informa esse modo. Os registros persistem após recarregar, mas **não são compartilhados entre computadores, navegadores ou endereços de site**. Limpar os dados do navegador remove os registros. Exporte o histórico regularmente; o CSV contém as trocas, não as inspeções nem o kanban. O modo local requer navegador atualizado com Web Locks e HTTPS (ou localhost).

O painel não muda do servidor para armazenamento local durante uma falha de conexão. Falhas de rede/500 são exibidas como erro, para evitar registros em bancos diferentes inadvertidamente. Após adicionar uma API a uma hospedagem antes local, os registros locais não são migrados automaticamente.

## Servidor compartilhado (para a equipe)

```bash
docker compose up -d --build
```

Abra `http://localhost:8000` ou `http://IP-DO-SERVIDOR:8000` na rede. Sem configuração de senha. O painel identifica a API e usa o banco SQLite centralizado. Todos devem acessar o mesmo servidor. O volume `ccq-data` preserva os registros. Não execute `docker compose down -v`, pois apaga o volume.

Sem Docker: Node.js 22+, Python 3.12+ e base de fusos IANA (no Windows: `pip install tzdata`).

```bash
npm ci
npm run build
python server/app.py
```

Desenvolvimento: API acima + `npm run dev` em outro terminal. O Vite encaminha `/api` à porta 8000. `PORT` e `CCQ_DB` são variáveis opcionais. O backend Python requer servidor com disco persistente; hospedagem estática não executa o banco centralizado.

## Acesso e dados

Acesso livre, conforme solicitado. O operador é identificado pelo nome informado, não autenticado. Quem tiver acesso ao endereço pode consultar e registrar dados. Para uso interno, disponibilize na rede da empresa/VPN. Não há exclusão de trocas pela interface. Bancos anteriores são preservados; a tabela de sessões antiga, caso exista, fica sem uso.

Na primeira utilização, registre a data real de instalação por posição com motivo “Primeiro cadastro / instalação”. As cores representam tempo de uso, não medição física. O checklist é preenchido por pessoas, sem conexão com sensores. Trocas não encerram atividades automaticamente. Cada inspeção com anomalia gera uma atividade.

Faça backup consistente do banco do servidor pela API de backup SQLite (ou pare o servidor antes de copiar os arquivos). CSV exporta todas as trocas, independentemente dos filtros.

## Verificação

```bash
npm test
npm run build
```

Testes Python da API sem login e regras de negócio; testes Node do armazenamento local, cores, troca, checklist, kanban e persistência. Os testes Node requerem Node 22.18+ ou 24+ (suporte a TypeScript sem compilação).


## Dashboard de estatísticas

A aba Estatísticas substitui o kanban de manutenção e apresenta trocas no período, motivo principal, turno com maior frequência, intervalo médio entre trocas, tendência mensal, distribuição por motivo/turno/posição e tempo médio entre trocas por posição. O período pode ser filtrado por 30 dias, 90 dias, 12 meses ou todo o histórico. O intervalo é calculado entre duas trocas consecutivas da mesma posição e considera o motivo do segundo registro; o primeiro cadastro fornece o ponto de partida.

O botão “Modo noturno” no menu alterna a aparência e guarda a escolha no navegador.

## Compatibilidade de nome

O sistema foi renomeado de CCQ para **RB1 Roll**. Para não perder registros existentes, os identificadores internos foram mantidos: chave local `ccq.local.v1`, tema `ccq.theme`, cabeçalho `X-CCQ-Request`, variável `CCQ_DB` e o volume Docker `ccq-data`.
