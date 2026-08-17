# 🤖 Chatbot & Prospectador con IA

**Plataforma white-label de chatbots de ventas con IA**: entrená agentes conversacionales, simulá chats antes de publicarlos, gestioná leads en un CRM integrado y medí resultados — todo pensado para revender a otros negocios bajo marca propia.

[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](#)

🇦🇷 [Español](#-sobre-el-proyecto) | 🇬🇧 [English](#-about-the-project)

---

## 📌 Sobre el proyecto

Producto pensado para agencias y freelancers que quieren vender chatbots de prospección con IA a sus clientes sin construir todo desde cero: incluye entrenamiento del agente, un simulador de conversación para probar el tono y las respuestas antes de salir a producción, un CRM liviano para los leads que genera el bot, un panel de analíticas y un módulo White Label para personalizar la marca de cada cliente.

## ✨ Características principales

- **Entrenador de agentes** (`AgentTrainer`): configuración de la personalidad, reglas y conocimiento del chatbot.
- - **Simulador de chat** (`ChatSimulator`): probar conversaciones end-to-end antes de publicar el bot.
  - - **CRM integrado** (`CRMAdmin`): gestión de los leads y prospectos que capta el chatbot.
    - - **Panel de analíticas** (`AnalyticsPanel`): métricas de conversaciones, conversión y actividad.
      - - **Tabla comparativa** (`ComparisonTable`): comparación de planes/funcionalidades para la venta del producto.
        - - **Estudio White Label** (`WhiteLabelStudio`): personalización de marca para revender el producto a distintos clientes.
         
          - ## 🛠️ Stack tecnológico
         
          - | Capa | Tecnología |
          - |---|---|
          - | Frontend | React + TypeScript + Vite |
          - | Backend | `server.ts` (Node) |
         
          - ## 🚀 Cómo correrlo localmente
         
          - ```bash
            git clone https://github.com/octi35/Proyecto-chatbot-y-prospectador-con-ia.git
            cd Proyecto-chatbot-y-prospectador-con-ia
            npm install

            # Copiar .env.example a .env.local con las API keys necesarias
            npm run dev
            ```

            ## 📁 Estructura del proyecto

            ```
            src/
            ├── App.tsx
            ├── data.ts
            └── components/
                ├── AgentTrainer.tsx
                ├── ChatSimulator.tsx
                ├── CRMAdmin.tsx
                ├── AnalyticsPanel.tsx
                ├── ComparisonTable.tsx
                └── WhiteLabelStudio.tsx
            server.ts   # Backend / lógica del chatbot
            ```

            ## 📄 Licencia

            MIT

            ---

            ## 🇬🇧 About the project

            A product built for agencies and freelancers who want to sell AI-powered prospecting chatbots to their clients without building everything from scratch: it includes agent training, a chat simulator to test tone and responses before going live, a lightweight CRM for the leads the bot generates, an analytics dashboard, and a White Label module to rebrand the product per client.

            ### ✨ Key features

            Agent trainer for chatbot personality/rules, an end-to-end chat simulator, an integrated CRM for captured leads, an analytics dashboard, a plan/feature comparison table, and a White Label studio for reselling under different brands.

            ### 🛠️ Tech stack

            React + TypeScript + Vite frontend with a lightweight Node (`server.ts`) backend.

            ### 🚀 Getting started

            ```bash
            npm install
            # copy .env.example to .env.local with the required API keys
            npm run dev
            ```

            ---

            ## 👤 Autor / Author

            **Octavio Fakiani** — Full Stack Developer & Analista de Sistemas

            - 🌐 Portfolio: [octaviofakiani.vercel.app](https://octaviofakiani.vercel.app/)
            - - 💼 LinkedIn: [octavio-fakiani](https://www.linkedin.com/in/octavio-fakiani-6662b5274/)
              - - 🐙 GitHub: [@octi35](https://github.com/octi35)
                - - ✉️ Email: octifaki@gmail.com
                  - 
