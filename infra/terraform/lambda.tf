data "archive_file" "weekly_summary_zip" {
  type        = "zip"
  source_file = "${path.module}/../../server/dist/lambdas/weekly-summary.js"
  output_path = "${path.module}/.build/weekly-summary.zip"
}

data "archive_file" "debt_reminders_zip" {
  type        = "zip"
  source_file = "${path.module}/../../server/dist/lambdas/debt-reminders.js"
  output_path = "${path.module}/.build/debt-reminders.zip"
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

resource "aws_iam_role" "lambda_exec" {
  name               = "${local.name}-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_ses" {
  name = "${local.name}-lambda-ses"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

locals {
  lambda_env = {
    DATABASE_HOST     = aws_rds_cluster.main.endpoint
    DATABASE_PORT     = "5432"
    DATABASE_USER     = aws_rds_cluster.main.master_username
    DATABASE_PASSWORD = var.db_password
    DATABASE_NAME     = aws_rds_cluster.main.database_name
    DATABASE_SSL      = "true"
    SMTP_FROM     = var.smtp_from
  }
}

resource "aws_lambda_function" "weekly_summary" {
  function_name    = "${local.name}-weekly-summary"
  role             = aws_iam_role.lambda_exec.arn
  filename         = data.archive_file.weekly_summary_zip.output_path
  source_code_hash = data.archive_file.weekly_summary_zip.output_base64sha256
  handler          = "weekly-summary.handler"
  runtime          = "nodejs20.x"
  timeout          = 120

  environment {
    variables = local.lambda_env
  }

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.ecs.id]
  }
}

resource "aws_lambda_function" "debt_reminders" {
  function_name    = "${local.name}-debt-reminders"
  role             = aws_iam_role.lambda_exec.arn
  filename         = data.archive_file.debt_reminders_zip.output_path
  source_code_hash = data.archive_file.debt_reminders_zip.output_base64sha256
  handler          = "debt-reminders.handler"
  runtime          = "nodejs20.x"
  timeout          = 120

  environment {
    variables = local.lambda_env
  }

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.ecs.id]
  }
}

resource "aws_cloudwatch_event_rule" "weekly_summary" {
  name                = "${local.name}-weekly-summary"
  description         = "Run weekly summary generator"
  schedule_expression = "cron(59 23 ? * SUN *)"
}

resource "aws_cloudwatch_event_target" "weekly_summary" {
  rule = aws_cloudwatch_event_rule.weekly_summary.name
  arn  = aws_lambda_function.weekly_summary.arn
}

resource "aws_lambda_permission" "weekly_summary_events" {
  statement_id  = "AllowEventsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.weekly_summary.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_summary.arn
}

resource "aws_cloudwatch_event_rule" "debt_reminders" {
  name                = "${local.name}-debt-reminders"
  description         = "Run daily debt reminders"
  schedule_expression = "cron(0 8 * * ? *)"
}

resource "aws_cloudwatch_event_target" "debt_reminders" {
  rule = aws_cloudwatch_event_rule.debt_reminders.name
  arn  = aws_lambda_function.debt_reminders.arn
}

resource "aws_lambda_permission" "debt_reminders_events" {
  statement_id  = "AllowEventsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.debt_reminders.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.debt_reminders.arn
}

