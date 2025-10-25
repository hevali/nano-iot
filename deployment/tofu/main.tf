terraform {
  required_providers {
    hcloud = {
      source  = "opentofu/hcloud"
      version = "1.54.0"
    }
    ssh = {
      source  = "loafoe/ssh"
      version = "2.7.0"
    }
    tls = {
      source  = "opentofu/tls"
      version = "4.1.0"
    }
    random = {
      source  = "opentofu/random"
      version = "3.7.2"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

provider "ssh" {
}

provider "tls" {
}

provider "random" {
}
