const jws = require('jws');
/////el mismo secreto con el que se verifica en funciones/comunes/auth.js: si firmaramos
/////con uno y verificaramos con otro, nadie podria entrar
const {SECRETO} = require('../funciones/comunes/auth');

let jwtgenerator = (obj) => {

    let userpayloaddata = {
        "identificador":obj[0],
        "nombre":obj[1],
        "codigo":obj[2],
        "id_area":obj[3],
        "nom_area":obj[4],
        "id_grupo":obj[5],
        "nom_grupo":obj[6]
    }

    const firma = {
        header:{alg:'HS256',"typ":"JWT"},
        payload:userpayloaddata,
        secret:SECRETO
    }

    return jws.sign(firma);
}

module.exports={jwtgenerator}