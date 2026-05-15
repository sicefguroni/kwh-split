terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source = "hashicorp/aws"
      # 6.23+ reads the same `aws login` / console credential cache as Terraform 1.14's S3 backend (LoginProvider).
      # Provider v5 only sees the legacy chain and falls through to EC2 IMDS on a laptop.
      version = ">= 6.23.0, < 7.0.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  backend "s3" {
    bucket         = "split-terraform-646385694637-ap-southeast-1-an"
    key            = "split/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "terraform-locks-split"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  # Explicit profile avoids "IMDS only" when the process does not inherit AWS_PROFILE (some GUIs / wrappers).
  profile = trimspace(var.aws_profile) != "" ? var.aws_profile : null
}
