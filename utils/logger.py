import paste.translogger


class CustomTransLogger:
    def __init__(self, _app, setup_console_handler=True):
        self.logger_app = paste.translogger.TransLogger(
            _app, setup_console_handler=setup_console_handler)

    def __call__(self, environ, start_response):
        if environ["REQUEST_METHOD"] == "GET":
            return self.logger_app.application(environ, start_response)
        return self.logger_app(environ, start_response)
