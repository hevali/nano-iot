data "hcloud_zone" "main" {
  name = var.dns_zone
}

data "tls_public_key" "key" {
  private_key_openssh = file(var.ssh_key_path)
}
