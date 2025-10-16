//importa as bibliotecas
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const app = express();
app.use(express.json());
const port = 3000;

//conexão com o banco de dados
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados:", err.message);
  } else {
    console.log("Conexão com o banco de dados SQLite estabelecida.");
    criarTabelas();
  }
});

//função para criar tabelas
function criarTabelas() {
  const sql = `
    CREATE TABLE IF NOT EXISTS Alunos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matricula TEXT NOT NULL UNIQUE,
        nome TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Recursos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identificador TEXT NOT NULL UNIQUE,
        tipo TEXT NOT NULL CHECK(tipo IN ('Computador', 'Mesa'))
    );

    CREATE TABLE IF NOT EXISTS Registros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER,
        recurso_id INTEGER,
        hora_entrada TEXT NOT NULL,
        hora_saida TEXT,
        FOREIGN KEY(aluno_id) REFERENCES Alunos(id),
        FOREIGN KEY(recurso_id) REFERENCES Recursos(id)
    );
`;

  db.exec(sql, (err) => {
    if (err) {
      console.error("Erro ao criar tabelas:", err.message);
    } else {
      console.log("Tabelas criadas com sucesso.");
    }
  });
}

//rotas da API
app.get("/", (req, res) => {
  res.send("Hello, World! Nosso servidor está no ar.");
});

//rotas da API para recursos
app.get("/api/recursos", (req, res) => {
  const sql = "SELECT * FROM Recursos ORDER BY identificador";
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ recursos: rows });
  });
});

//rota post para adicionar recurso
app.post("/api/recursos", (req, res) => {
  const { identificador, tipo } = req.body;

  if (!identificador || !tipo) {
    return res
      .status(400)
      .json({ error: "Identificador e tipo são obrigatórios." });
  }

  const sql = "INSERT INTO Recursos (identificador, tipo) VALUES (?, ?)";
  db.run(sql, [identificador, tipo], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({
      message: "Recurso adicionado com sucesso!",
      recurso: { id: this.lastID, identificador, tipo },
    });
  });
});

//rotas da API para alunos
app.get("/api/alunos", (req, res) => {
  const sql = "SELECT * FROM Alunos ORDER BY nome";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ alunos: rows });
    });
});

//rota post para adicionar aluno
app.post("/api/alunos", (req, res) => {
  const { matricula, nome } = req.body;

  if (!matricula || !nome) {
    return res.status(400).json({ error: "Matrícula e nome são obrigatórios." });
    }

  const sql = "INSERT INTO Alunos (matricula, nome) VALUES (?, ?)";
  db.run(sql, [matricula, nome], function (err) {
    if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ error: "Matrícula já está cadastrada." });
        }
        return res.status(500).json({ error: err.message });
    }
    res.status(201).json({
        message: "Aluno adicionado com sucesso!",
        aluno: { id: this.lastID, matricula, nome },
    });
  });
});

//rotas da API para registros
app.get("/api/registros/ativos", (req, res) => {
    const sql = `
        SELECT
            r.id as registro_id,
            a.nome,
            a.matricula,
            rec.identificador as recurso,
            r.hora_entrada
        FROM Registros r
        JOIN Alunos a ON r.aluno_id = a.id
        JOIN Recursos rec ON r.recurso_id = rec.id
        WHERE r.hora_saida IS NULL
        ORDER BY r.hora_entrada`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ registros: rows });
    });
});

//rota post para adicionar registro
app.post('/api/registros/entrada', (req, res) => {
    const { matricula, identificadorRecurso } = req.body;

    if (!matricula || !identificadorRecurso) {
        return res.status(400).json({ error: "Matrícula e identificador do recurso são obrigatórios." });
    }

    db.serialize(() => {
        //encontra o aluno pela matrícula
        const findAlunoSql = "SELECT id FROM Alunos WHERE matricula = ?";
        const findRecursoSql = "SELECT id FROM Recursos WHERE identificador = ?";

        db.get(findAlunoSql, [matricula], (err, aluno) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!aluno) return res.status(404).json({ error: "Aluno não encontrado." });

            db.get(findRecursoSql, [identificadorRecurso], (err, recurso) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!recurso) return res.status(404).json({ error: "Recurso não encontrado." });

                //verifica se o aluno já tem uma sessão ativa
                const checkAtivoSql = "SELECT * FROM Registros WHERE aluno_id = ? AND hora_saida IS NULL";
                db.get(checkAtivoSql, [aluno.id], (err, registroAtivo) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (registroAtivo) return res.status(400).json({ error: "Este aluno já possui uma sessão ativa." });

                    //se tudo ok, insere o novo registro
                    const insertSql = "INSERT INTO Registros (aluno_id, recurso_id, hora_entrada) VALUES (?, ?, ?)";
                    const horaEntrada = new Date().toISOString();

                    db.run(insertSql, [aluno.id, recurso.id, horaEntrada], function (err) {
                        if (err) return res.status(500).json({ error: err.message });
                        res.status(201).json({
                            message: "Entrada registrada com sucesso!", registroId: this.lastID });
                        });
                    });
                });
            });
        });
    });

//rota post para registrar saída
app.post('/api/registros/saida', (req, res) => {
    const { matricula } = req.body;

    if (!matricula) {
        return res.status(400).json({ error: "Matrícula é obrigatória." });
    }

    //atualiza a hora_saida do registro que está ativo (hora_saida IS NULL) para o aluno com a matrícula fornecida
    const sql = `
        UPDATE Registros
        SET hora_saida = ?
        WHERE aluno_id = (SELECT id FROM Alunos WHERE matricula = ?)
        AND hora_saida IS NULL
        `;
        const horaSaida = new Date().toISOString();

    db.run(sql, [horaSaida, matricula], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        //verifica se alguma linha foi atualizada
        if (this.changes === 0) {
            return res.status(404).json({ error: "Nenhum registro ativo encontrado para esta matrícula." });
        }
        res.status(200).json({ message: "Saída registrada com sucesso!" });
    });
});


//inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  console.log(`Para testar, acesse em http://localhost:${port}`);
});
