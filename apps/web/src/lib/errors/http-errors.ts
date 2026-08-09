export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Solicitud inválida') {
    super(400, message, 'BAD_REQUEST');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso no autorizado') {
    super(403, message, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicto con el estado actual') {
    super(409, message, 'CONFLICT');
  }
}

export class UnprocessableError extends AppError {
  constructor(message = 'Transición de estado no permitida') {
    super(422, message, 'UNPROCESSABLE');
  }
}

export class InternalError extends AppError {
  constructor(message = 'Error interno del servidor') {
    super(500, message, 'INTERNAL_ERROR');
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor(message = 'Confirma tu correo electrónico para iniciar sesión') {
    super(403, message, 'EMAIL_NOT_VERIFIED');
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Demasiadas solicitudes, intenta más tarde') {
    super(429, message, 'TOO_MANY_REQUESTS');
  }
}

export class BadGatewayError extends AppError {
  constructor(message = 'Servicio externo no disponible') {
    super(502, message, 'BAD_GATEWAY');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Servicio no disponible') {
    super(503, message, 'SERVICE_UNAVAILABLE');
  }
}
