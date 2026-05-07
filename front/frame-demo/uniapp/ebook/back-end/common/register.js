const client = require("./client"); 
function selectBy(username) {
  return new Promise((resolve, reject) => {
    let sql = "select * from login where username='"+username+"'"
    let state = []
    client.query(sql,function(error, results){
      if(results[0]){
        state.push(0)
      }
      else {
        state.push(1)
      }
      resolve(state)
    })
  })   
}
// 插入一条数据
function register(username, password,res) {
selectBy(username).then(resp => {
    let state=[];
    state = resp
    console.log(state)
    if (state[0]) {
      let sql = "insert into login values('" + username + "','" + password + "')";
      client.query(sql,function (error, results) {
        if (error) {
          console.log("[INSERT ERROR] - ", error.message);
          return;
        }
        res.send(username);
      });
    }
    else res.send("fail");
  })
}
module.exports = register;
