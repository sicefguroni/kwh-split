data "archive_file" "reminder_lambda" {
  type        = "zip"
  output_path = "${path.module}/.build/reminder.zip"
  source {
    content  = <<-EOT
      exports.handler = async () => {
        console.log("reminder stub: wire SES/SNS + DB here");
        return { ok: true };
      };
    EOT
    filename = "index.js"
  }
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "reminder_lambda" {
  name               = "${local.name}-reminder-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "reminder_lambda_basic" {
  role       = aws_iam_role.reminder_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "reminder" {
  function_name    = "${local.name}-reminder"
  role             = aws_iam_role.reminder_lambda.arn
  filename         = data.archive_file.reminder_lambda.output_path
  source_code_hash = data.archive_file.reminder_lambda.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
}

resource "aws_cloudwatch_event_rule" "reminder_daily" {
  name                = "${local.name}-reminder-daily"
  description         = "Stub schedule for SMS/email reminders (Lambda)"
  schedule_expression = "rate(24 hours)"
}

resource "aws_cloudwatch_event_target" "reminder" {
  rule       = aws_cloudwatch_event_rule.reminder_daily.name
  arn        = aws_lambda_function.reminder.arn
  depends_on = [aws_lambda_permission.reminder_events]
}

resource "aws_lambda_permission" "reminder_events" {
  statement_id  = "AllowEventsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reminder.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.reminder_daily.arn
}
