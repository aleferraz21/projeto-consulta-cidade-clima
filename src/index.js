const express = require('express'); // Framework web para criar a API REST
const cors = require('cors'); // Middleware para permitir requisições de outros domínios
const axios = require('axios'); // Cliente HTTP para fazer requisições externas

const app = express();

// Middlewares
app.use(cors()); // Habilita CORS para permitir chamadas de origens diferentes
app.use(express.json()); // Faz o parsing do body em JSON nas requisições

// Healthcheck: simples endpoint para verificar se o serviço está respondendo
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: "healthy",
    versao: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Endpoint para listar cidades de uma sigla de UF
// - Valida a sigla (deve ter exatamente 2 caracteres)
// - Aceita query `limite` para limitar a quantidade de resultados (padrão 10)
// - Usa a BrasilAPI (dados do IBGE) para obter os municípios
app.get('/api/v1/cidades/:sigla_uf', async (req, res) => {
  const { sigla_uf } = req.params;
  const limite = parseInt(req.query.limite) || 10;

  // Validação simples da sigla de estado
  if (sigla_uf.length !== 2) {
    return res.status(400).json({
      erro: true,
      codigo: "SIGLA_UF_INVALIDA",
      mensagem: "A sigla do estado deve conter exatamente 2 letras",
      sigla_uf_informada: sigla_uf
    });
  }

  try {
    // Chama a BrasilAPI para obter municípios do estado (IBGE)
    const response = await axios.get(`https://brasilapi.com.br/api/ibge/municipios/v1/${sigla_uf}`);
    // Formata os resultados retornando apenas o nome das cidades e aplica o limite
    const cidadesFormatadas = response.data.slice(0, limite).map(c => ({ nome: c.nome }));
    
    res.status(200).json({
      uf: sigla_uf.toUpperCase(), // Converte a sigla para maiúscula
      quantidade_retornada: cidadesFormatadas.length, 
      cidades: cidadesFormatadas,
      consultado_em: new Date().toISOString()
    });
  } catch (error) {
    // Em caso de erro (por exemplo, sigla não encontrada ou erro na API externa), retorna 404
    res.status(404).json({
      erro: true,
      codigo: "UF_NAO_ENCONTRADA",
      mensagem: "Estado com a sigla informada não foi encontrado",
      sigla_uf_informada: sigla_uf
    });
  }
});

// Função utilitária para traduzir códigos de condição climática do Open-Meteo
// Recebe um `weathercode` numérico e retorna uma descrição em português
function traduzirClima(codigo) {
  const mapeamento = {
    0: "Céu limpo",
    1: "Principalmente limpo", 2: "Parcialmente nublado", 3: "Encoberto",
    51: "Drizzle leve", 53: "Drizzle moderado", 55: "Drizzle denso",
    61: "Chuva leve", 63: "Chuva moderada", 65: "Chuva forte",
    80: "Pancadas de chuva leves", 81: "Pancadas de chuva moderadas", 82: "Pancadas de chuva violentas",
    95: "Trovoada leve ou moderada",
  };
  return mapeamento[codigo] || "Condição desconhecida";
}

// Endpoint para obter o clima atual de uma cidade pelo nome

app.get('/api/v1/clima/:nome_cidade', async (req, res) => {
  const { nome_cidade } = req.params;

  // Validação simples do parâmetro de entrada
  if (nome_cidade.length < 2) {
    return res.status(400).json({
      erro: true,
      codigo: "NOME_INVALIDO",
      mensagem: "O nome da cidade deve conter pelo menos 2 caracteres",
      nome_informado: nome_cidade
    });
  }

  try {
    // Monta a URL de geocoding para obter coordenadas da cidade
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome_cidade)}&count=1&language=pt&format=json`;
    const geoRes = await axios.get(geoUrl);

    // Se não houver resultados, retorna 404
    if (!geoRes.data.results || geoRes.data.results.length === 0) {
      return res.status(404).json({
        erro: true,
        codigo: "CIDADE_NAO_ENCONTRADA",
        mensagem: "Nenhuma cidade encontrada com o nome informado",
        nome_informado: nome_cidade
      });
    }

    // Pega a primeira ocorrência encontrada (melhor correspondência)
    const { latitude, longitude, name, admin1 } = geoRes.data.results[0];

    // Consulta o clima atual usando latitude/longitude
    const climaUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    const climaRes = await axios.get(climaUrl);

    // Retorna os dados principais: nome, estado, temperatura e descrição da condição
    res.status(200).json({
      nome: name,
      estado: admin1,
      clima: {
        temperatura: climaRes.data.current_weather.temperature,
        condicao: traduzirClima(climaRes.data.current_weather.weathercode), unidades: {
          temperatura: "°C"
        }
      },
      consultado_em: new Date().toISOString()
    });

  } catch (error) {
    // Em caso de falha ao consultar serviços externos retorna 503
    res.status(503).json({
      erro: true,
      codigo: "SERVICO_EXTERNO_INDISPONIVEL",
      mensagem: "Não foi possível obter dados do serviço externo.",
      servico: "Open-Meteo"
    });
  }
});

const PORT = 3000;

// Inicia o servidor somente quando não estiver em ambiente de teste.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`O Servidor Online em http://localhost:${PORT}`);
  });
}

// Exporta a instância do Express para permitir testes e reuso em outros módulos
module.exports = app;