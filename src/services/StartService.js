const moment = require("moment");

const Dados = require("../controllers/Dados");
const Parametros = require("../controllers/Parametros");
const ReferencesService = require("./ReferencesService");
const VeiculosService = require("./VehiclesService");
const OrdersService = require("./OrdersService");

class StartService {
  constructor(window, db) {
    this.dados = new Dados(db);
    this.parametros = new Parametros(db);

    this.referencesService = new ReferencesService(window, db);
    this.veiculosService = new VeiculosService(window, db);
    this.ordersService = new OrdersService(window, db);

    this.tokens = [];
    this.window = window;
  }

  async start() {
    try {
      this.writeLog(
        `(${new Date().toLocaleString()}) - Serviço geral iniciado`
      );

      const { gps_aberto, filiais } = (await this.dados.getDados())[0];

      const date_time = gps_aberto ? gps_aberto.replace("|", " ") : moment();

      const ms = moment(moment(), "DD/MM/YYYY HH:mm:ss").diff(
        moment(date_time, "DD/MM/YYYY HH:mm:ss")
      );

      this.tokens = await this.parametros.getTokens({
        filiais,
      });

      if (this.tokens.length > 0) {
        if (!gps_aberto || ms >= 1000 * 600) {
          await this.dados.setDados({
            datetime: moment().format("DD/MM/YYYY|HH:mm:ss"),
          });

          await this.veiculosService.execute({ tokens: this.tokens });

          await this.referencesService.execute({ tokens: this.tokens });

          await this.ordersService.execute({ tokens: this.tokens });

          await this.dados.setDados({
            datetime: "",
          });
        } else {
          this.writeLog(
            `(${new Date().toLocaleString()}) - Outro integrador aberto. (${
              gps_aberto ? gps_aberto.replace("|", " ") : ""
            })`
          );
        }
      } else {
        this.writeLog(
          `(${new Date().toLocaleString()}) - Sem tokens para sincronizar`
        );
      }

      this.writeLog(
        `(${new Date().toLocaleString()}) - Serviço geral finalizado`
      );
    } catch (err) {
      this.writeLog(
        `(${new Date().toLocaleString()}) - Erro serviço geral: ${err.message}`
      );
    }

    setTimeout(() => this.start(), 60000);
  }

  async forcaAtualizacao() {
    let forca_atualizacao = false;

    try {
      this.writeLog(
        `(${new Date().toLocaleString()}) - Verifica forca atualização iniciado`
      );

      forca_atualizacao = await this.dados.getForcaAtualizacao();

      if (!forca_atualizacao) clearTimeout(this.timeoutRun);

      this.writeLog(
        `(${new Date().toLocaleString()}) - Verifica forca atualização finalizado`
      );
    } catch (err) {
      this.writeLog(
        `(${new Date().toLocaleString()}) - Erro verifica forca atualização: ${
          err.message
        }`
      );
    }

    return forca_atualizacao;
  }

  async getNomeGeral() {
    try {
      const nomegeral = await this.dados.getNomeGeral();

      this.window.webContents.send("nomegeral", {
        nomegeral,
      });
    } catch (err) {}
    return;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  writeLog(log) {
    this.window.webContents.send("log", {
      log,
      type: "generals",
    });
  }
}

module.exports = StartService;