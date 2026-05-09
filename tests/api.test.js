const request = require('supertest');
const app = require('../src/index'); // Importa sua API preparada

describe('Testes de Integração - API de Clima (N703)', () => {
  
  // Teste 1: Verificar se uma cidade válida retorna sucesso 
  it('Deve retornar status 200 e dados corretos para Fortaleza', async () => {
    const res = await request(app).get('/api/v1/clima/Fortaleza');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nome', 'Fortaleza');
    expect(res.body).toHaveProperty('clima');
    expect(res.body.clima).toHaveProperty('temperatura');
  });

  // Teste 2: Verificar erro para cidade não encontrada
  it('Deve retornar status 404 para uma cidade que não existe', async () => {
    const res = await request(app).get('/api/v1/clima/CidadeInexistente123');
    expect(res.status).toBe(404);
    expect(res.body.erro).toBe(true);
    expect(res.body.codigo).toBe('CIDADE_NAO_ENCONTRADA');
  });
});