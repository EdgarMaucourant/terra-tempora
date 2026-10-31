// The public half of the key that seals the email of visitors who offer to
// help with their report (see src/feedback.ts). Written by
// `npm run contact-key`; the private half stays on the maintainer's computer
// in .keys/ and never enters the repository. While this is null the offer to
// help is hidden.

export const CONTACT_KEY: { id: string; spki: string } | null = {
  id: "e1ede12045c2",
  spki: "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAqrsOJzhdNS6RG6OtWuis91+JaSz7Jv6oasYva/AtFFRaEFVetdYStbbCcoUh5Z2Se/hEkXMkHtkCcBwAsh1z6hXgc5B3b6G6JTiXweFKD9E5VMroTKBPpT70bndhsLSANrPWzOxoVD4PHfE0aEIMhTpM2NQH5GKuxLBIBJfH5hroJdr66DwAlQap2SkWz6M94f3jlXd+yZ/jhtkCUTW02u60DP2ZXJfnldpym5nAHbKhRQjOGTy8zd3sZxaG9FxUBQz1Rk8DuDkcGfMl13atvEQ51g5pZOe+Uv/HngZpwVLnH5vlFF7815ah3j6EOyhBNcoFlnVf6dW4LQ/8+aJ0k7obd0IRB+ppn2L+BmpqTWYGS/3Nnrm+ac8WJQzoFMC4oD5p6QFvzy4zPFN4dieJjGsv7+aVMukTKggrjuBVWnCtXd26IynN4JyLtJ28CTMHLpaJJDcjZ/bkHjlC47+RTlkiGU+Ce05i4x0cAXIjj1Lxr9x3Vgn6C8UXCWC62EZAXXGWjcGxrvbZ4aEGhIYKLj0jVgJlNLUa0Qzm3l13ioG4HHvZtHIiw2QFu0Mucr95EXphQavg+detwYhcYXSxqNkYuN4YvwlG+GCqdTaDCJY2DTQ5bSu9NFOUC8SDAZDHZCV0hXXYGpQ9362J4s0o034HhKeVgH2eiM7aZ/a7agUCAwEAAQ==",
};
