// Craque do Jogo — demonstração de autenticação de mensagens com HMAC-SHA256.
// Projeto acadêmico: NÃO é um sistema de votação real seguro.

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Chave secreta do MAC: lida da variável de ambiente (.env local ou Environment Variables do Vercel).
// Nunca vai para o frontend.
const CHAVE_SECRETA = process.env.MAC_SECRET;
if (!CHAVE_SECRETA) {
  console.error('MAC_SECRET não definida (arquivo .env ou variáveis de ambiente do Vercel).');
}
app.use('/api', (req, res, next) => {
  if (!CHAVE_SECRETA) return res.status(500).json({ erro: 'MAC_SECRET não configurada no servidor.' });
  next();
});

// "Banco de dados" em memória.
const jogadores = {
  jogador1: { nome: 'Ronaldo Fenômeno', votos: 0 },
  jogador2: { nome: 'Zinedine Zidane', votos: 0 },
};
const noncesUsados = new Set(); // nonces de votos já registrados

// Monta a mensagem que será autenticada: dados do voto + nonce.
function montarMensagem(jogador, nonce) {
  return `voto=${jogador};nonce=${nonce}`;
}

// MAC = HMAC-SHA256(chave secreta, mensagem), usando a biblioteca crypto nativa do Node.js.
function calcularMac(mensagem) {
  return crypto.createHmac('sha256', CHAVE_SECRETA).update(mensagem).digest('hex');
}

// Compara os MACs em tempo constante (evita vazar informação pelo tempo de resposta).
function macsIguais(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Consulta o placar.
app.get('/api/votos', (req, res) => {
  res.json(jogadores);
});

// Passo 1: o servidor prepara o voto e gera o MAC com a chave secreta.
app.post('/api/preparar-voto', (req, res) => {
  const { jogador } = req.body;
  if (!jogadores[jogador]) {
    return res.status(400).json({ erro: 'Jogador inexistente.' });
  }

  const nonce = crypto.randomUUID();

  const mensagem = montarMensagem(jogador, nonce);
  const mac = calcularMac(mensagem);

  res.json({ jogador, nonce, mac, mensagem });
});

// Passo 2: o servidor recebe o voto e VERIFICA o MAC antes de registrar.
app.post('/api/votar', (req, res) => {
  const { jogador, nonce, mac } = req.body;

  if (typeof jogador !== 'string' || typeof nonce !== 'string' || typeof mac !== 'string') {
    return res.status(400).json({ erro: 'Requisição incompleta.' });
  }

  // Recalcula o MAC sobre a mensagem RECEBIDA usando a chave secreta.
  const mensagemRecebida = montarMensagem(jogador, nonce);
  const macEsperado = calcularMac(mensagemRecebida);

  console.log('\n--- Verificação do voto ---');
  console.log('Mensagem recebida:', mensagemRecebida);
  console.log('MAC recebido     :', mac);
  console.log('MAC esperado     :', macEsperado);

  if (!macsIguais(mac, macEsperado)) {
    console.log('Resultado        : ✗ MAC inválido — voto rejeitado');
    return res.status(400).json({ erro: 'MAC inválido. Voto rejeitado.', mensagemRecebida });
  }

  // MAC válido: a mensagem é íntegra e foi gerada pelo servidor (só ele tem a chave).
  // O nonce só pode ser usado uma vez (impede reenviar o mesmo voto).
  if (noncesUsados.has(nonce)) {
    console.log('Resultado        : ✗ nonce já utilizado');
    return res.status(400).json({ erro: 'Nonce já utilizado. Voto rejeitado.' });
  }
  if (!jogadores[jogador]) {
    return res.status(400).json({ erro: 'Jogador inexistente.' });
  }

  noncesUsados.add(nonce);
  jogadores[jogador].votos++;
  console.log('Resultado        : ✓ MAC válido — voto aceito');
  res.json({ mensagem: 'Voto aceito.', mensagemRecebida, placar: jogadores });
});

// Zera o placar para refazer os testes durante a apresentação.
app.post('/api/zerar', (req, res) => {
  for (const id in jogadores) jogadores[id].votos = 0;
  noncesUsados.clear();
  console.log('\n--- Placar zerado ---');
  res.json(jogadores);
});

// Local (npm start): sobe o servidor. No Vercel, o app exportado vira uma função serverless.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Craque do Jogo rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
