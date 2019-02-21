const Table = require('cli-table');

/**
 * 格式化打印Log
 * @param {object} data 
 */
function formatLog(data) {
  //console.log(JSON.stringify(data, null, 2));

  if (!Array.isArray(data)) {
    data = [data];
  } else if (data.length === 0) {
    return;
  }

  const head = Object.keys(data[0]);
  let printData = data.map(item => {
    return head.map(key => JSON.stringify(item[key], null, 1) || '');
  });

  const table = new Table({
    head,
    colWidths: new Array(head.length).fill(25)
  });
  table.push(...printData);
  console.log(table.toString());
};

/**
 * 判断两个对象是否相等
 * @param {object} obj1 
 * @param {object} obj2 
 */
function isEqualObj(obj1, obj2) {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)
  if (keys1.length !== keys2.length) {
    return false;
  }
  return keys1.every(key => obj1[key] === obj2[key]);
}

module.exports = { formatLog, isEqualObj };