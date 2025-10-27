output "server_ip" {
  value = hcloud_server.server.ipv4_address
}

output "webadmin_password" {
  value     = random_password.webadmin_password.result
  sensitive = true
}

output "basic_auth_password" {
  value     = random_password.basic_auth.result
  sensitive = true
}
