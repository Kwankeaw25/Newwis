FROM nginx:alpine

# Copy nginx configuration
COPY nginx-default.conf /etc/nginx/conf.d/default.conf

# Copy static frontend files to Nginx directory (must match root in nginx-default.conf)
COPY Frontend/ /webapp/

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
