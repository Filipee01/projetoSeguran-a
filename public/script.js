// Frontend: NÃO conhece a chave secreta. Apenas pede ao servidor o voto
// preparado (com MAC) e depois o envia de volta para verificação.

const $ = (id) => document.getElementById(id);

const ICONE_OK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const ICONE_ERRO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

let requisicaoOriginal = null; // requisição preparada pelo servidor (modo demonstração)
let timerToast;

// ---------- Placar ----------
async function atualizarPlacar() {
  const res = await fetch('/api/votos');
  const placar = await res.json().catch(() => ({}));
  if (!res.ok) return mostrarResultado(false, placar.erro || `Erro no servidor (HTTP ${res.status})`);
  const total = placar.jogador1.votos + placar.jogador2.votos;

  for (const id of ['jogador1', 'jogador2']) {
    const votos = placar[id].votos;
    const pct = total ? Math.round((votos / total) * 100) : 0;
    $(`votos-${id}`).textContent = votos;
    $(`pct-${id}`).textContent = `${pct}%`;
    $(`barra-${id}`).style.width = total ? `${pct}%` : '0';
  }
}

// ---------- Exibição do resultado ----------
function mostrarResultado(ok, texto) {
  const html = (ok ? ICONE_OK : ICONE_ERRO) + `<span>${texto}</span>`;
  const classe = ok ? 'ok' : 'erro';

  $('info-resultado').className = `resultado ${classe}`;
  $('info-resultado').innerHTML = html;

  if (!$('area-demo').hidden) {
    $('demo-resultado').className = `resultado ${classe}`;
    $('demo-resultado').innerHTML = html;
    $('demo-resultado').hidden = false;
  }

  const toast = $('toast');
  toast.className = `toast ${classe}`;
  toast.innerHTML = html;
  toast.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { toast.hidden = true; }, 4000);
}

// ---------- Passo 1: servidor gera nonce + MAC para o voto escolhido ----------
async function prepararVoto(jogador) {
  const res = await fetch('/api/preparar-voto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jogador }),
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) {
    mostrarResultado(false, dados.erro || `Erro no servidor (HTTP ${res.status})`);
    throw new Error(dados.erro);
  }

  $('info-mensagem').textContent = dados.mensagem;
  $('info-mac').textContent = dados.mac;
  $('info-resultado').className = 'resultado';
  $('info-resultado').textContent = 'Aguardando envio';

  return { jogador: dados.jogador, nonce: dados.nonce, mac: dados.mac };
}

// ---------- Passo 2: envia { jogador, nonce, mac }; o servidor recalcula e compara o MAC ----------
async function enviarVoto(requisicao) {
  const res = await fetch('/api/votar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requisicao),
  });
  const resposta = await res.json();

  if (resposta.mensagemRecebida) $('info-mensagem').textContent = resposta.mensagemRecebida;
  $('info-mac').textContent = requisicao.mac;

  if (res.ok) mostrarResultado(true, 'Voto aceito. MAC válido.');
  else mostrarResultado(false, resposta.erro);

  atualizarPlacar();
}

// ---------- Botões de voto ----------
document.querySelectorAll('.btn-votar').forEach((botao) => {
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    try {
      const requisicao = await prepararVoto(botao.dataset.jogador);
      if ($('modo-demo').checked) abrirDemo(requisicao);
      else await enviarVoto(requisicao);
    } finally {
      botao.disabled = false;
    }
  });
});

// ---------- Modo demonstração: edita a requisição antes do envio ----------
const CAMPOS = ['jogador', 'nonce', 'mac'];

function abrirDemo(requisicao) {
  requisicaoOriginal = requisicao;
  CAMPOS.forEach((c) => { $(`req-${c}`).value = requisicao[c]; });
  marcarAlterados();
  $('demo-vazio').hidden = true;
  $('area-demo').hidden = false;
  $('demo-resultado').hidden = true;
  $('painel-demo').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('req-jogador').focus();
}

function marcarAlterados() {
  CAMPOS.forEach((c) => {
    const alterado = requisicaoOriginal && $(`req-${c}`).value !== requisicaoOriginal[c];
    document.querySelector(`.campo[data-campo="${c}"]`).classList.toggle('alterado', alterado);
  });
}

CAMPOS.forEach((c) => $(`req-${c}`).addEventListener('input', marcarAlterados));

$('modo-demo').addEventListener('change', (e) => {
  if (!e.target.checked) {
    $('area-demo').hidden = true;
    $('demo-vazio').hidden = false;
  }
});

$('restaurar').addEventListener('click', () => {
  if (requisicaoOriginal) abrirDemo(requisicaoOriginal);
});

$('enviar-demo').addEventListener('click', () => {
  enviarVoto({
    jogador: $('req-jogador').value.trim(),
    nonce: $('req-nonce').value.trim(),
    mac: $('req-mac').value.trim(),
  });
});

// ---------- Zerar votos: volta tudo ao estado inicial para refazer os testes ----------
$('zerar').addEventListener('click', async () => {
  await fetch('/api/zerar', { method: 'POST' });
  requisicaoOriginal = null;
  $('info-mensagem').textContent = 'Nenhum voto enviado ainda';
  $('info-mac').textContent = '—';
  $('info-resultado').className = 'resultado';
  $('info-resultado').textContent = 'Aguardando voto';
  $('area-demo').hidden = true;
  $('demo-vazio').hidden = false;
  $('toast').hidden = true;
  atualizarPlacar();
});

atualizarPlacar();
