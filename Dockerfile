# Gunakan Node.js 18 Alpine untuk image yang ringan
FROM node:18-alpine

# Set direktori kerja
WORKDIR /app

# Salin package.json dan package-lock.json
COPY package*.json ./

# Instal semua dependensi (termasuk devDependencies untuk build)
RUN npm install

# Salin seluruh kode sumber
COPY . .

# Build frontend Vite menjadi file statis di folder /dist
RUN npm run build

# Set environment variable ke production
ENV NODE_ENV=production
# Set port default ke 5000 (sesuai permintaan Anda)
ENV PORT=5000

# Ekspos port 5000
EXPOSE 5000

# Jalankan server menggunakan tsx (karena server.ts adalah TypeScript)
CMD ["npx", "tsx", "server.ts"]
