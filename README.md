## 概览

1.哈希：散列函数，数据指纹，hash命令体验
2.区块：index,hash,previous,timestamp,nonce,txs
3.交易：from,to,value,sig
4.非对称加密：私钥随机，公钥通过私钥算出
5.P2P网络：NAT打洞，UDP

## 流程

1.创建node项目：
  创建nodejs-bc文件夹，npm init

2.安装命令行工具：vorpal
  npm install vorpal --save
  安装格式化输出工具：cli-table
  npm install cli-table --save
  安装椭圆加密算法
  npm install elliptic --save

3.src/utils.js
  formatLog(data)           //格式化打印Log
  isEqualObj(obj1, obj2)    //判断两个对象是否相等

4.src/client.js | src/index.js
  client(vorpal)            //启动命令行客户端

5.src/crypto.js
  keys                      //公私钥对
  generateKeys()            //生成公私钥对
  getPublicKey(prv)         //通过私钥获取公钥
  signMsg(msg, prv)         //使用私钥给消息签名
  verifyMsg(msg, sig, pub)  //使用公钥验证消息签名
  sha256Hash(msg)           //获取SHA-256哈希值

6.src/blockchain.js
  init()                                        //初始化区块链
  bindProcessEvent()                            //绑定进程事件
  bindUdpEvent()                                //绑定UDP通信事件
  startNode(port)                               //启动节点

  handleReceivedMessage(action, remote)         //处理接收到的消息
  sendMessage(msg, {port, address})             //发送消息
  sendBroadcast(msg)                            //广播消息

  mine()                                        //挖矿
  transfer(from, to, value)                     //转账
  balance(address)                              //余额
  generateNewBlock()                            //生成新区块
  getPrevBlock()                                //获取链上的最新区块
  hash(index, previous, timestamp, txs, nonce)  //计算区块的哈希值
  hashForBlock(block)                           //计算区块的哈希值
  updatePeerList(peers)                         //更新本地节点列表
  replaceChain(newChain)                        //替换区块链数据
  replaceTxs(txs)                               //替换交易数据
  addTx(tx)                                     //添加交易到本地交易列表  
  isValidChain(chain)                           //区块链是否合法   
  isValidNewBlock(newBlock, previousBlock)      //新区块是否合法             
  isValidTxs(txs)                               //交易列表是否合法
  isValidTx(tx)                                 //单个交易是否合法    
  signTx({from, to, value, timestamp})          //交易签名
  verifyTx({from, to, value, timestamp, sig})   //验证交易

7.调用generateNewBlock()生成创世区块
  const Blockchain = require('./blockchain');
  const bc = new Blockchain();
  const block = bc.generateNewBlock();
  console.log(block);
