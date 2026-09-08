from flyt.core.exceptions import DomainException


class LessonError(DomainException):
    pass


class LessonNotFoundError(LessonError):
    def __init__(self, message: str = "Lesson not found"):
        super().__init__(message, "LESSON_NOT_FOUND")


class LessonNotStartedError(LessonError):
    def __init__(self, message: str = "Lesson not started"):
        super().__init__(message, "LESSON_NOT_STARTED")


class LessonNotCompleteError(LessonError):
    def __init__(self, message: str = "Lesson not complete"):
        super().__init__(message, "LESSON_NOT_COMPLETE")


class ExerciseNotFoundError(LessonError):
    def __init__(self, message: str = "Exercise not found in lesson"):
        super().__init__(message, "EXERCISE_NOT_FOUND")


class ExerciseResponseInvalidError(LessonError):
    def __init__(self, message: str):
        super().__init__(message, "WRITE_RESPONSE_INVALID")


class ExerciseEvaluationUnavailableError(LessonError):
    def __init__(self, message: str = "Exercise evaluation is temporarily unavailable"):
        super().__init__(message, "WRITE_JUDGE_UNAVAILABLE")


class LessonImportError(LessonError):
    def __init__(self, message: str):
        super().__init__(message, "LESSON_IMPORT_ERROR")


class LessonUpdateError(RuntimeError):
    pass
