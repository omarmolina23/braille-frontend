/** Errores comunes de los adaptadores del dispositivo (el real y el simulador). */

export class ErrorProtocolo extends Error {
  override name = 'ErrorProtocolo';
}
export class ErrorTiempoAgotado extends ErrorProtocolo {
  override name = 'ErrorTiempoAgotado';
}
export class ErrorIncompatible extends ErrorProtocolo {
  override name = 'ErrorIncompatible';
}
/** Una orden en curso se canceló porque la conexión se cerró (cable retirado, desconexión). */
export class ErrorConexionCerrada extends ErrorProtocolo {
  override name = 'ErrorConexionCerrada';
}
