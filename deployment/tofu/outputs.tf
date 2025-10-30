output "server_ip" {
  value = hcloud_server.server.ipv4_address
}

output "user_password" {
  value     = random_password.user_password.result
  sensitive = true
}
