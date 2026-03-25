FROM nginx:alpine



# Copy static frontend files to Nginx directory
COPY Frontend/ /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
