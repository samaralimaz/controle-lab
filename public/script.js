document.addEventListener('DOMContentLoaded', () => {

    const formEntrada = document.getElementById('form-entrada');
    const inputMatricula = document.getElementById('input-matricula');
    const selectRecurso = document.getElementById('select-recurso');
    const tabelaStatus = document.getElementById('tabela-status');

    //função 1:busca os recursos na API e preenche o menu dropdown

    async function fetchRecursos() {
        try {
            //chama a rota GET /api/recursos
            const response = await fetch('/api/recursos');
            const data = await response.json();

            selectRecurso.innerHTML = '<option value="">Selecione um recurso</option>';

            //para cada recurso, cria um <option> no select
            data.recursos.forEach(recurso => {
                const option = document.createElement('option');
                option.value = recurso.identificador;
                option.textContent = `${recurso.identificador} (${recurso.tipo})`;
                selectRecurso.appendChild(option);
            });
        } catch (error) {
            console.error('Erro ao buscar recursos:', error);
            selectRecurso.innerHTML = '<option value="">Erro ao carregar recursos</option>';
        }
    } 
    
    //função 2: busca os registros ativos e preenche a tabela de status
    async function fetchStatus() {
        try {
            //chama a rota GET /api/status
            const response = await fetch('/api/registros/ativos');
            const data = await response.json();


            if (data.registros.length === 0) {
                tabelaStatus.innerHTML =  '<tr><td colspan="5">Nenhum recurso em uso no momento.</td></tr>';
            } else {
                //para cada registro, cria uma linha (<tr>) na tabela
                data.registros.forEach(registro => {
                    const row = document.createElement('tr');
                    const horaEntrada = new Date(registro.hora_entrada).toLocaleString();

                    row.innerHTML = `
                    <td>${registro.nome}</td>
                    <td>${registro.matricula}</td>
                    <td>${registro.recurso}</td>
                    <td>${horaEntrada}</td>
                    <td>
                        <button class="btn-saida" data-matricula="${registro.matricula}">Registrar Saída</button>
                    </td>
                    `;
                    tabelaStatus.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Erro ao buscar status:', error);
            tabelaStatus.innerHTML = '<tr><td colspan="5">Erro ao carregar status</td></tr>';
        }
    }

    //evento 1: lida com o envio do formulário de entrada

    formEntrada.addEventListener('submit', async (e) => {
        e.preventDefault(); //impede que a página recarregue ao enviar o formulário

         const matricula = inputMatricula.value;
         const identificadorRecurso = selectRecurso.value;

         try {
            //chama a rota POST /api/registros/entrada enviando os dados no corpo da requisição
            const response = await fetch('/api/registros/entrada', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricula, identificadorRecurso })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error);
            }

            alert(result.message); //exibe a mensagem de sucesso
            formEntrada.reset(); //limpa o formulário
            fetchStatus(); //atualiza a tabela de status

         } catch (error) {
            console.error('Erro ao registrar entrada:', error);
            alert(`Erro: ${error.message}`);

         }

    });

    //eveneto 2: lida com cliques na tabeela para registrar saídas
    tabelaStatus.addEventListener('click', async (e) => {
        //verifica se o clique foi em um botão de saída
        if (e.target.classList.contains('btn-saida')) {
            const matricula = e.target.dataset.matricula; //pega a matrícula guardada no botão

            if (confirm(`Deseja registrar a saída para a matrícula ${matricula}?`)) {
                try {
                    //chama a rota POST /api/registros/saida
                    const response = await fetch('/api/registros/saida', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ matricula })
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error);
                    }

                    alert(result.message);
                    fetchStatus();

                } catch (error) {
                    console.error('Erro ao registrar saída:', error);
                    alert(`Erro: ${error.message}`);
                }
            }
        }
    });

    //inicializa a página
    fetchRecursos();
    fetchStatus();
});