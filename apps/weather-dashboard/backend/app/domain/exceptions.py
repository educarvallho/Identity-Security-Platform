class DomainException(Exception):
    pass


class InvalidCredentialsException(DomainException):
    pass


class InactiveUserException(DomainException):
    pass


class ForbiddenException(DomainException):
    pass


class NotFoundException(DomainException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(f"{resource} not found")


class TokenExpiredException(DomainException):
    pass


class InvalidTokenException(DomainException):
    pass


class OpenAIUnavailableException(DomainException):
    pass
