const fs = require('fs');
const crypto = require('crypto')
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

let keyPair = ec.genKeyPair();
const keys = generateKeys();

/**
 * 通过私钥获取公钥
 * @param {string} prv 
 */
function getPublicKey(prv){
  return ec.keyFromPrivate(prv).getPublic('hex').toString();
}

/**
 * 生成公私钥对
 */
function generateKeys() {
  const fileName = `${__dirname}/wallet.json`;

  try {
    let res = JSON.parse(fs.readFileSync(fileName));
    if(res.prv && res.pub && getPublicKey(res.prv) === res.pub){
      keyPair = ec.keyFromPrivate(res.prv);
      return res;
    }else{
      throw new Error('[Error]: invalid wallet file');
    }
  } catch (error) {
    let res = {
      prv: keyPair.getPrivate('hex').toString(),
      pub: keyPair.getPublic('hex').toString()
    };
    fs.writeFileSync(fileName, JSON.stringify(res));
    return res;
  }
}

/**
 * 使用私钥给消息签名
 * @param {string} msg 
 * @param {string} prv 
 */
function signMsg(msg, prv = keys.prv){
  const binaryMsg = Buffer.from(msg);
  return Buffer
    .from(ec.keyFromPrivate(prv).sign(binaryMsg).toDER())
    .toString('hex');
}

/**
 * 使用公钥验证消息签名
 * @param {string} msg 
 * @param {string} sig 
 * @param {string} pub 
 */
function verifyMsg(msg, sig, pub){
  const binaryMsg = Buffer.from(msg);
  return ec.keyFromPublic(pub, 'hex').verify(binaryMsg, sig);
}

/**
 * 获取SHA-256哈希值
 * @param {string} msg 
 */
function sha256Hash(msg){
  return crypto.createHash('sha256').update(String(msg)).digest('hex');
}


module.exports = {keys, signMsg, verifyMsg, getPublicKey, sha256Hash};



