var processarDisciplinas = function (ds) {
    for (var i = 0; i < ds.length; i++) {
        completarDisciplina(i, ds[i]);
    }
    return ds;
};

var completarDisciplina = function(id, d) {
    var patt = /(.*) (\w+(?=-))-(\w+) \((.*)\)/;
    var match = patt.exec(d.nome);
    d.nomeSimples = match[1];
    d.turmas = [match[2]];
    d.periodo = match[3];
    d.campus = match[4];
    var turma = d.nomeSimples+' '+
        d.turmas[0]+'-'+
        (d.periodo=="Matutino" ? "diurno" : "noturno")+
        ' ('+(d.campus=="São Bernardo" ? "São Bernardo do Campo" : d.campus)+')';
    d.turma = turmasSalas[turma];
    d.contagemMatriculas = contagemMatriculas[d.id] || 0;
    d.contagemMatriculasIngressantes = contagemMatriculasIngressantes[d.id] || 0;
    for (var i in d.horarios) {
        var h = d.horarios[i];
        h.horas.pop();
        if (h.semana == 0) {
            h.semana = 6;
        }
    }

    d.sigla = "";
    var partes = d.nomeSimples.split(" ");
    for (var i in partes) {
        var caractere = partes[i].charAt(0);
        if (caractere == caractere.toUpperCase()) {
            d.sigla += caractere;
        }
    }

    var descParts = [d.codigo, d.nomeSimples, d.sigla, d.periodo, d.campus, d.turmas, d.horarios.map(function(h) {return nomeDoDia(h.semana); })];

    descParts = [].concat.apply([], descParts);
    d.descricao = normalizarTexto(descParts.join(' ').toUpperCase());
};

var buscarDisciplinas = function(termo) {
    var partes = normalizarTexto(termo || '').split(" ");

    return todasDisciplinas.filter(function(d) {
        for (var i = 0; i < partes.length; i++) {
            if (d.descricao.indexOf(partes[i]) === -1) {
                return false;
            }
        }
        return true;
    });
};

var verificarConflito = function(d1, d2) {
    for (var i in d1.horarios) {
        var h1 = d1.horarios[i];
        for (var j in d2.horarios) {
            var h2 = d2.horarios[j];

            if (h1.periodicidade_extenso == h2.periodicidade_extenso ||
                h1.periodicidade_extenso == " - semanal" ||
                h2.periodicidade_extenso == " - semanal") {
                if (h1.semana == h2.semana) {
                    for (var m in h1.horas) {
                        var hs1 = h1.horas[m];
                        for (var n in h2.horas) {
                            var hs2 = h2.horas[n];
                            if (hs1 == hs2) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }
    return false;
}

var verificarConflitoMulti = function(d, ds) {
    var horarios = $.unique([].concat.apply([], ds.map(function(d) {return d.horarios})));
    return verificarConflito(d, {horarios: horarios});
}

var gerarCor = function(i) {
    return ['#F44336', //Red
            '#9C27B0', //Purple
            '#009688', //Teal
            '#8BC34A', //Light Green
            '#607D8B', //Blue Grey
            '#FF5722', //Deep Orange
            '#4CAF50', //Green
            '#03A9F4', //Light Blue
            '#E91E63', //Pink
            '#795548', //Brown
           ][i];
}

var nomeDoDia = function(d) {
    return ['SABADO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'][d];
}

var normalizarTexto = function(texto) {
    return texto.toUpperCase()
        .replace(/[ÂÁÃÀ]/g, "A")
        .replace(/[ÊÉÈ]/g, "E")
        .replace(/[ÍÌÎ]/g, "I")
        .replace(/[ÓÔÕÒ]/g, "O")
        .replace(/[ÚÙÛ]/g, "U")
        .replace(/Ç/g, "C")
        .trim();
};

var todasDisciplinas = processarDisciplinas(todasDisciplinas);
var disciplinasEscolhidas = [];
var periodo = "diatodo";
var somenteQuinzenaAtual = false;

var atualizarHash = function() {
    var ids = $.map(disciplinasEscolhidas, function(el, i) {
        return el.id;
    });
    var hash = ids.join(',') + ';' + periodo + ';' + (somenteQuinzenaAtual ? 'atual' : 'ambas');
    window.location.hash = hash;
    if (localStorageAvailable()) {
        localStorage.setItem("hash", hash);
    }
}

var resgatarHash = function() {
    var hashed = window.location.hash.substring(1);
    if (!hashed.length && localStorageAvailable()) {
        hashed = localStorage.getItem("hash");
    }
    if (hashed.length) {
        var afterSplit = hashed.split(';');
        var ids = afterSplit[0].split(',');
        disciplinasEscolhidas.length = 0;
        for (var i in ids) {
            var d = todasDisciplinas.filter(function(d) {return d.id==ids[i]})[0];
            if (d) {
                disciplinasEscolhidas.push(d);
                d.escolhida = true;
            }
        }
        periodo = afterSplit[1];
        somenteQuinzenaAtual = afterSplit[2] == "atual";
        atualizarGrade();
    }
}

var numeroDoDia = {
    "segunda": 1,
    "terça": 2,
    "quarta": 3,
    "quinta": 4,
    "sexta": 5,
    "sabádo": 6
};
var salasRegex = /(.*) das (\d\d:\d\d) às \d\d:\d\d, sala (.*(?=,)), (.*)/;
var encontrarSala = function(turma, salas) {
    if (salas == null || salas.length == 0) return '';
    for (let sala of salas) {
        var dia = sala[1];
        var hora = sala[2];
        var salao = sala[3];
        var semana = sala[4];
        if (numeroDoDia[dia]==turma.semana &&
           turma.horas[0]==hora &&
           semana==turma.periodicidade_extenso.replace(' - ','').replace('(','').replace(')','')
        ) {
            return salao;
        }
    }
    return '';
}

var atualizarGrade = function() {
    atualizarHash();
    atualizarPeriodo();

    for (var i in disciplinasEscolhidas) {
        var d = disciplinasEscolhidas[i];
        var turma = d.turma;
        var salas = [];
        if (turma["TEORIA"] != "0")
            salas = salas.concat(turma["TEORIA"].split(" , "));
        if (turma["PRÁTICA"] != "0")
            salas = salas.concat(turma["PRÁTICA"].split(" , "));
        var salasMatches = salas.map(function(sala){return salasRegex.exec(sala);});

        for (var j in d.horarios) {
            var h = d.horarios[j];
            var dia = moment().utc().day(h.semana);
            var inicio = dia
                .hours(parseInt(h.horas[0].split(':')[0]))
                .minutes(parseInt(h.horas[0].split(':')[1]))
                .seconds(1)
                .toISOString();
            var fim = dia
                .hours(parseInt(h.horas[h.horas.length - 1].split(':')[0]))
                .minutes(parseInt(h.horas[h.horas.length - 1].split(':')[1]) + 30)
                .seconds(0)
                .toISOString();
            var grade = $('.grade');
            if (h.periodicidade_extenso === " - quinzenal (I)")
                grade = $("#grade-a");
            else if (h.periodicidade_extenso === " - quinzenal (II)")
                grade = $("#grade-b");
            grade.fullCalendar('renderEvent', {
                title: d.sigla + "\n\r" + encontrarSala(h, salasMatches),
                //url: linkHelp(d),
                start: inicio,
                end: fim,
                color: gerarCor(i)
            });
        }
    }
}

var atualizarPeriodo = function() {
    var minTime = '8:00:00',
        maxTime = '23:30:00';

    if (periodo == "noite")
        minTime = '19:00:00';

    if (periodo == "manha")
        maxTime = '19:00:00';

    options.minTime = minTime;
    options.maxTime = maxTime;
    $('.grade').fullCalendar('destroy');
    $('.grade').fullCalendar(options);
}
