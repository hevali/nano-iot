variable "hcloud_token" {
  type      = string
  sensitive = true
}

variable "dns_zone" {
  type = string
}

variable "sub_domain" {
  type     = string
  nullable = true
}

variable "ssh_key_path" {
  type = string
}

variable "github_token" {
  type      = string
  sensitive = true
}

variable "gemini_api_key" {
  type      = string
  sensitive = true
}
