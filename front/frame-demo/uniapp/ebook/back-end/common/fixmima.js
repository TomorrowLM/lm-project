const client = require('./client')

// 查询数据
function fixmima(mima, res) {
    console.log(mima)
    let zhanghao = mima.zhanghao
    let oldmima = "select * from login where username='"+zhanghao+"'and password='" + mima.oldmima + "'"
    let newmima = "update login set password='" + mima.newmima + "' where username='" + zhanghao + "'"
    client.query(oldmima, function (error, results) {
        console.log(results.length)
        if(!results.length){res.send('fail')}
        else{
            client.query(newmima, function (error, results) {
                res.send('success')
            });
        }
    });


}
module.exports = fixmima