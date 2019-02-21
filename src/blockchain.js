const fs = require('fs');
const dgram = require('dgram');
const utils = require('./utils');
const cryptos = require('./cryptos');

const ACTION_NEW_PEER_JOINED = 'new_peer_joined';
const ACTION_SAY_HI_TO_NEW_PEER = 'say_hi_to_new_peer';
const ACTION_UPDATE_PEER_FILE = 'update_peer_file';
const ACTION_UPDATE_PEER_LIST = 'update_peer_list';
const ACTION_DELETE_PREV_PEER = 'delete_prev_peer';
const ACTION_SYNC_BLOCKCHAIN = 'sync_blockchain';
const ACTION_NEW_TRANSACTION = 'new_transaction';
const ACTION_NEW_BLOCK_MINED = 'new_block_mined';
const ACTION_MESSAGE = 'message';

const genesisBlock = { 
  index: 0,
  previous: '0',
  timestamp: 1550673768466,
  nonce: 766168,
  hash: '00000e8277887b729da7f0085736f24bbdce1727e33ab7c90e0ea5b6eea9eb0f',
  txs: 'Welcome to my-blockchain !' 
};

class Blockchain {

  constructor(){
    this.chain = [genesisBlock];    //区块链数据
    this.txs_unpackaged = [];       //还没有打包的交易数据
    this.difficulty = 5;            //挖矿难度（哈希值的前多少位为'0'）
    
    this.is_wan = false;            //是否在外网运行
    this.udp = dgram.createSocket('udp4');
    this.peers = [];                //P2P网络节点列表
    this.localPeer = {};            //本地节点
    this.seedPeer = {               //种子节点
      port: 8001,
      address: 'localhost'
    };

    //本地节点的地址信息存在文件中，用于节点退出的逻辑
    this.localPeerFile = `${__dirname}/address_info.json`;

    this.init();
  }

  /**
   * 初始化区块链
   */
  init(){
    this.bindProcessEvent();
    this.bindUdpEvent();

    const port = Number(process.argv[2]) || 0;
    this.startNode(port);
  }

  /**
   * 绑定进程事件
   */
  bindProcessEvent(){
    process.on('exit', () => {
      console.log('[信息]: 网络一线牵，珍惜这段缘 再见')
    });    
  }

  /**
   * 绑定UDP通信事件
   */
  bindUdpEvent(){
    //处理接收到的消息（remote：消息发送方）
    this.udp.on('message', (data, remote) => {
      const action = JSON.parse(data);
      if(action.type){
        this.handleReceivedMessage(action, remote);
      }
    });
    //处理错误
    this.udp.on('error', (err) => {
      console.log('[错误]:', err)
    });
    //UDP监听服务启动后
    this.udp.on('listening', () => {
      const addressInfo = this.udp.address();
      console.log(`[信息]: UDP服务监听完毕: ${addressInfo.address}:${addressInfo.port}`);
    });
  }

  /**
   * 启动节点
   * @param {number} port 
   */
  startNode(port){
    this.udp.bind(port);

    //普通节点
    if(port !== 8001){
      if(this.is_wan && fs.existsSync(this.localPeerFile)){
        const addressInfo = JSON.parse(fs.readFileSync(this.localPeerFile));
        if(addressInfo.address && addressInfo.port){
          this.sendMessage({
            type: ACTION_DELETE_PREV_PEER,
            data: addressInfo
          }, this.seedPeer);
        }
      }

      this.sendMessage({
        type: ACTION_NEW_PEER_JOINED,
      }, this.seedPeer);

      this.peers.push(this.seedPeer);
    }
  }

  /**
   * 处理接收到的消息
   * @param {object} action 
   * @param {object} remote 
   */
  handleReceivedMessage(action, remote){
    switch(action.type){

      case ACTION_NEW_PEER_JOINED:
        //种子节点来处理
        console.log('[信息]: 有新节点加入，大家快去打个招呼');
        //通知所有节点打招呼
        this.sendBroadcast({
          type: ACTION_SAY_HI_TO_NEW_PEER,
          data: remote
        });
        //通知新节点更新本地地址信息
        this.sendMessage({
          type: ACTION_UPDATE_PEER_FILE,
          data: remote
        }, remote);
        //通知新节点更新节点列表
        this.sendMessage({
          type: ACTION_UPDATE_PEER_LIST, 
          data: {peers: this.peers}
        }, remote);
        //通知新节点同步区块链数据
        this.sendMessage({
          type: ACTION_SYNC_BLOCKCHAIN,
          data: JSON.stringify({chain: this.chain, txs: this.txs_unpackaged})
        }, remote);
        //新节点添加到（种子节点的）本地节点列表
        this.peers.push(remote);
        break;

      case ACTION_DELETE_PREV_PEER:
        //种子节点来处理
        let i = this.peers.findIndex(p => 
          p.address === action.data.address && p.port === action.data.port);
        if(i >= 0){
          //删除本地节点列表中的指定节点信息
          this.peers.splice(i, 1);
          this.sendBroadcast(action);
        }  
        break;

      case ACTION_UPDATE_PEER_FILE:
        this.localPeer = action.data;
        fs.writeFileSync(this.localPeerFile, JSON.stringify(action.data));
        break;

      case ACTION_SAY_HI_TO_NEW_PEER:
        const newPeer = action.data;
        this.peers.push(newPeer);
        console.log('[信息]: 有新的节点加入: ', newPeer.port, newPeer.address);
        this.sendMessage({
          type: ACTION_MESSAGE,
          data: {msg : '你好，新朋友'}
        }, newPeer);
        break;

      case ACTION_MESSAGE:
        console.log(`${remote.address}:${remote.port} 发来一条消息: ${action.data.msg}`);
        break;

      case ACTION_UPDATE_PEER_LIST:
        this.updatePeerList(action.data.peers);  
        break;

      case ACTION_SYNC_BLOCKCHAIN:
        console.log('[信息]: 同步本地区块链');
        const data = JSON.parse(action.data);
        this.replaceTxs(data.txs);
        if(data.chain.length > 1){
          this.replaceChain(data.chain);
        }
        break;

      case ACTION_NEW_TRANSACTION:
        if(!this.txs_unpackaged.find(tx => utils.isEqualObj(tx, action.data))){
          console.log('[信息]: 有新的交易');
          utils.formatLog(action.data);

          this.addTx(action.data);
          this.sendBroadcast({type: ACTION_NEW_TRANSACTION, data: action.data});
        }
        break;

      case ACTION_NEW_BLOCK_MINED:
        const prevBlock = this.getPrevBlock();
        if(prevBlock.hash === action.data.hash){
          return;
        }

        if(this.isValidNewBlock(action.data, prevBlock)){
          console.log('[信息]: 有人挖矿成功，恭喜TA!');
          this.chain.push(action.data);
          this.txs_unpackaged = [];
          this.sendBroadcast({type: ACTION_NEW_BLOCK_MINED, data: action.data});
        }else{
          console.log('[错误]: 不合法的区块', action.data);
        }
        break;

      default:
        console.log(`[错误]: 不合法的消息 '${JSON.stringify(action)}' from 
          ${remote.address}:${remote.port}`);
        break;
    }
  }

  /**
   * 发送消息
   * @param {string} msg 
   * @param {object} addressInfo 
   */
  sendMessage(msg, {port, address}){
    this.udp.send(JSON.stringify(msg), port, address);
  }

  /**
   * 广播消息
   * @param {string} msg 
   */
  sendBroadcast(msg) {
    this.peers.forEach(addressInfo => {
      this.sendMessage(msg, addressInfo);
    });
  }

  /**
   * 挖矿
   */
  mine(){
    const startTime = new Date().getTime();
    if(!this.isValidTxs(this.txs_unpackaged)){
      return;
    }
    //挖矿奖励
    this.transfer('0', cryptos.keys.pub, 50);

    const newBlock = this.generateNewBlock();
    if(this.isValidNewBlock(newBlock, this.getPrevBlock())){
      this.chain.push(newBlock);
      this.txs_unpackaged = [];
    }else{
      console.log('[错误]: 不合法的区块', newBlock);
    }

    this.sendBroadcast({type: ACTION_NEW_BLOCK_MINED, data: newBlock}); 
    
    const endTime = new Date().getTime();
    const offset = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`[信息]: 挖矿结束，用时${offset}s , 计算${newBlock.nonce}次, 哈希值: ${newBlock.hash}, 收入: 50`);
    return newBlock;
  }

  /**
   * 转账
   * @param {string} from 
   * @param {string} to 
   * @param {number} value 
   */
  transfer(from, to, value){
    value = parseInt(value);
    if (isNaN(value)) {
      console.log('[信息]: value必须是数字');
      return;
    }

    const timestamp = new Date().getTime();
    const sig = this.signTx({from, to, value, timestamp});
    
    let tx = {from, to, value, sig, timestamp};
    if(from !== '0'){
      const balance = this.balance(from);
      if (balance < value) {
        console.log(`[信息]: 余额不足，还剩${balance}，待支出${value}`);
        return;
      }
      this.sendBroadcast({type: ACTION_NEW_TRANSACTION, data: tx});
    }
    this.txs_unpackaged.push(tx);
    return tx;
  }

  /**
   * 余额
   * @param {string} address 
   */
  balance(address = cryptos.keys.pub){
    let balance = 0;

    for(const block of this.chain){
      for(const tx of block.txs){
        if (tx.from === address){
          balance -= tx.value;
        }
        if (tx.to === address){
          balance += tx.value;
        }
      }
    }
    return balance;
  }

  /**
   * 生成新区块
   */
  generateNewBlock(){
    const index = this.chain.length;
    const previous = this.getPrevBlock().hash;
    const txs = this.txs_unpackaged;

    let nonce = 0;
    let timestamp = new Date().getTime();
    let hash = this.hash(index, previous, timestamp, txs, nonce);
    while (hash.slice(0, this.difficulty) !== '0'.repeat(this.difficulty)) {
      nonce += 1;
      timestamp = new Date().getTime();
      hash = this.hash(index, previous, timestamp, txs, nonce);
    }
    return {
      index,
      previous,
      timestamp,
      nonce,
      hash,
      txs
    };
  }

  /**
   * 获取链上的最新区块
   */
  getPrevBlock(){
    return this.chain[this.chain.length - 1];
  }

  /**
   * 更新本地节点列表
   * @param {array} peers 
   */
  updatePeerList(peers){
    peers.forEach(newPeer => {
      if (!this.peers.find(peer => utils.isEqualObj(peer, newPeer))) {
        this.peers.push(newPeer);
      }
    });
  }

  /**
   * 添加交易到本地交易列表
   * @param {object} tx 
   */
  addTx(tx){
    if (this.isValidTx(tx)) {
      this.txs_unpackaged.push(tx);
    }
  }

  /**
   * 替换交易数据
   * @param {array} txs 
   */
  replaceTxs(txs){
    if (this.isValidTxs(txs)){
      this.txs_unpackaged = txs;
    }
  }

  /**
   * 替换区块链数据
   * @param {array} newChain 
   */
  replaceChain(newChain){
    if (newChain.length === 1) {
      return;
    }
    if(this.isValidChain(newChain) && newChain.length > this.chain.length){
      this.chain = JSON.parse(JSON.stringify(newChain));
    }else{
      console.log('[错误]: 区块链数据不合法');
    }
  }

  /**
   * 交易列表是否合法
   * @param {array} txs 
   */
  isValidTxs(txs){
    return txs.every(tx => this.isValidTx(tx));
  }

  /**
   * 单个交易是否合法
   * @param {object} tx 
   */
  isValidTx(tx){
    return tx.from === '0' ? true : this.verifyTx(tx);
  }

  /**
   * 新区块是否合法
   * @param {object} newBlock 
   * @param {objcet} previousBlock 
   */
  isValidNewBlock(newBlock, previousBlock){
    const newBlockHash = this.hashForBlock(newBlock)
    if(previousBlock.index+1 !== newBlock.index){
      console.log('[错误]: 新区块的索引错误')
      return false;
    }
    if(previousBlock.hash !== newBlock.previous){
      console.log(`[错误]: 第${newBlock.index}个区块的previous哈希错误`);
      return false;
    }
    if(newBlockHash !== newBlock.hash){
      console.log(`[错误]: 第${newBlock.index}个区块的哈希错误，数据被篡改`);
      return false;
    }
    if(newBlockHash.slice(0, this.difficulty) !== '0'.repeat(this.difficulty)){
      console.log('[错误]: 哈希值不合法');
      return false;
    }
    if(!this.isValidTxs(newBlock.txs)){
      console.log('[错误]: 交易不合法');
      return false;
    }
    return true;
  }

  /**
   * 区块链是否合法
   * @param {array} chain 
   */
  isValidChain(chain = this.chain){
    if (JSON.stringify(chain[0]) !== JSON.stringify(genesisBlock)) {
      return false;
    }
    for (let i = chain.length-1; i >= 1; i--) {
      if (!this.isValidNewBlock(chain[i], chain[i - 1])) {
        console.log(`[错误]: 第${i}个区块不合法`)
        return false
      }
    }
    return true
  }

  /**
   * 计算区块的哈希值
   * @param {number} index 
   * @param {string} previous 
   * @param {number} timestamp 
   * @param {array} txs 
   * @param {number} nonce 
   */
  hash(index, previous, timestamp, txs, nonce){
    return cryptos.sha256Hash(index + previous + timestamp + JSON.stringify(txs) + nonce);
  }

  /**
   * 计算区块的哈希值
   * @param {object} block 
   */
  hashForBlock(block){
    const { index, previous, timestamp, txs, nonce } = block;
    return this.hash(index, previous, timestamp, txs, nonce);
  }

  /**
   * 交易签名
   * @param {object} tx
   */
  signTx({from, to, value, timestamp}){
    return cryptos.signMsg(`${timestamp}-${value}-${from}-${to}`);
  }

  /**
   * 验证交易
   * @param {object} tx 
   */
  verifyTx({from, to, value, timestamp, sig}){
    return cryptos.verifyMsg(`${timestamp}-${value}-${from}-${to}`, sig, from);
  }

}

module.exports = Blockchain;
