const utils = require('./utils');
const cryptos = require('./cryptos');
const Blockchain = require('./blockchain');
const bc = new Blockchain();

function client(vorpal){
  vorpal
    .use(chainCommand)
    .use(blockCommand)
    .use(mineCommand)
    .use(transferCommand)
    .use(balanceCommand)
    .use(pendingCommand)
    .use(peersCommand)
    .use(pubCommand)
    .use(prvCommand)
    .use(welcome)
    .delimiter('my-blockchain => ')
    .show();
};

module.exports = client;

function welcome(vorpal){
  vorpal.log('Welcome to my-blockchain !');
  vorpal.exec('help');
}

function chainCommand(vorpal){
  vorpal
    .command('chain', '查看区块链')
    .action((args, callback) => {
      utils.formatLog(bc.chain);
      callback();
    });
}

function blockCommand(vorpal){
  vorpal
    .command('block <index>', '查看区块详情')
    .action((args, callback) => {
      const block = bc.chain[args.index];
      this.log(block);
      utils.formatLog(block);
      callback();
    });
}

function mineCommand(vorpal){
  vorpal
    .command('mine', '挖矿')
    .action((args, callback) => {
      try {
        let block = bc.mine()
        if (block) {
          utils.formatLog(block);
        }
      } catch (err) {
        this.log(err);
      }
      callback();
    });
}

function transferCommand(vorpal){
  vorpal
    .command('trans <to> <value>', '转账')
    .action((args, callback) => {
      try {
        const tx = bc.transfer(cryptos.keys.pub, args.to, args.value);
        if(tx){
          utils.formatLog(tx);
        }
      } catch (error) {
        this.log(error);
      }
      callback();
    });
}

function balanceCommand(vorpal){
  vorpal
    .command('balance [address]', '查看余额')
    .action((args, callback) => {
      try {
        const balance = bc.balance(args.address);
        utils.formatLog({address: args.address || cryptos.keys.pub, balance});
      } catch (error) {
        this.log(error);
      }
      callback();
    });
}

function pendingCommand(vorpal){
  vorpal
    .command('pending', '查看未打包进区块的交易')
    .action((args, callback) => {
      utils.formatLog(bc.txs_unpackaged);
      callback();
    });
}

function peersCommand(vorpal){
  vorpal
    .command('peers', '查看P2P网络节点')
    .action((args, callback) => {
      utils.formatLog(bc.peers);
      callback();
    });
}

function pubCommand(vorpal){
  vorpal
    .command('pub', '本地公钥(地址)')
    .action((args, callback) => {
      this.log(cryptos.keys.pub);
      callback();
    });
}

function prvCommand(vorpal){
  vorpal
    .command('prv', '本地私钥')
    .action((args, callback) => {
      this.log(cryptos.keys.prv);
      callback();
    })
}
