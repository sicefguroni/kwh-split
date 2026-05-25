terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.23.0, < 7.0.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
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
  region  = var.aws_region
  profile = trimspace(var.aws_profile) != "" ? var.aws_profile : null
}

provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = trimspace(var.aws_profile) != "" ? var.aws_profile : null
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
